import axios from 'axios';
import { ProducerType, type Producer } from '@prisma/client';
import { sleep } from '../../utils';
import { log } from '../../utils/log';
import { getProducers, updateProducerLastPostTime } from '../../db/producer';
import { processPost } from './person';
import type { Card, WeiboTopicResponse } from './types';

//Constants
const API_CONFIG = {
    baseUrl: 'https://m.weibo.cn/api/container/getIndex',
    headers: {
        "accept": "application/json, text/plain, */*",
    },
    delayMs: 5000,
    defaultMaxPages: 20,
    postedMaxPages: 5
} as const;

// 递归提取所有 card_type 为 9 的卡片
function extractType9Cards(data: Card[]): Card[] {
    const type9Cards: Card[] = [];

    // Start processing directly with the input array
    function processCards(cards: Card[]) {
        cards.forEach(card => {
            if (card.card_type === '9') {
                type9Cards.push(card);
            }

            if (card.card_group && Array.isArray(card.card_group)) {
                processCards(card.card_group);
            }
        });
    }

    // Process the input array directly
    processCards(data);

    return type9Cards;
}
export const processTopicPost = async (producer: Producer, maxPages: number): Promise<number> => {
    if (!producer.producerId) {
        log(`生产者 ${producer.name} 未找到话题ID，跳过`, 'warn');
        return 0;
    }

    // 如果有lastPostTime，则只爬取5页
    const actualMaxPages = producer.lastPostTime ? Math.min(API_CONFIG.postedMaxPages, maxPages) : maxPages;
    if (producer.lastPostTime) {
        log(`检测到lastPostTime，限制爬取页数为${API_CONFIG.postedMaxPages}页`, 'info');
    }

    log(`开始处理话题 ${producer.producerId}`);
    let totalProcessed = 0;
    let sinceId: number | undefined;

    for (let page = 0; page < actualMaxPages; page++) {
        try {
            const response = await axios.get<WeiboTopicResponse>(API_CONFIG.baseUrl, {
                params: {
                    containerid: producer.producerId,
                    ...(sinceId && { since_id: sinceId })
                },
                headers: API_CONFIG.headers
            });

            if (!response.data.ok || !response.data.data.cards?.length) break;

            sinceId = response.data.data.pageInfo.since_id;
            const validCards = extractType9Cards(response.data.data.cards);

            if (!validCards.length) continue;

            log(`正在处理第 ${page + 1} 页，共找到 ${validCards.length} 条帖子`);

            for (const card of validCards) {
                const count = await processPost(card.mblog, producer);
                totalProcessed += count;
            }

            await sleep(API_CONFIG.delayMs);
            if (!sinceId) break;
        } catch (error) {
            log(`获取话题页面失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
            break;
        }
    }

    log(`话题 ${producer.producerId} 处理完成，共保存 ${totalProcessed} 张有图片的帖子`, 'success');
    
    // 更新lastPostTime
    if (totalProcessed > 0) {
        await updateProducerLastPostTime(producer.id);
        log(`已更新话题 ${producer.name || producer.producerId} 的lastPostTime`, 'info');
    }
    
    return totalProcessed;
};

export const processWeiboTopic = async (maxPages: number = API_CONFIG.defaultMaxPages): Promise<number> => {
    const producers = await getProducers(ProducerType.WEIBO_SUPER_TOPIC);
    log(`共 ${producers.length} 个微博超话`, 'info');
    try {
        log('==== 开始获取微博话题帖子 ====');
        let totalCount = 0;
        
        // 计算总任务数
        const totalTopics = producers.length;
        let completedTopics = 0;

        for (const producer of producers) {
            log(`\n👤 处理生产者: ${producer.name} (${producer.id})`);
            const count = await processTopicPost(producer, maxPages);
            totalCount += count;
            completedTopics++;
            
            const remainingTopics = totalTopics - completedTopics;
            if (remainingTopics > 0) {
                log(`还剩 ${remainingTopics} 个话题待处理`);
            }
        }

        log(`\n==== 微博话题帖子获取完成，共处理 ${totalCount} 张图片 ====`, 'success');
        return totalCount;
    } catch (error) {
        log('微博话题处理失败: ' + error, 'error');
        return 0;
    }
};