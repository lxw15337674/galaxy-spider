import { ProducerType, type Producer } from '@prisma/client';
import { sleep } from '../../utils';
import { log } from '../../utils/log';
import { getProducers, updateProducerLastPostTime } from '../../db/producer';
import { processPost } from './person';
import type { Card, WeiboTopicResponse } from './types';
import { browserManager } from '../../browser';

//Constants
const API_CONFIG = {
    baseUrl: 'https://m.weibo.cn/api/container/getIndex',
    headers: {
        "accept": "application/json, text/plain, */*",
    },
    delayMs: 3000,
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

    // 创建 page 实例
    const page = await browserManager.createPage();

    try {
        log(`开始处理话题 ${producer.name || producer.producerId}，计划获取 ${actualMaxPages} 页`, 'info');
        let totalProcessed = 0;
        let sinceId: number | undefined;

        for (let pageNum = 0; pageNum < actualMaxPages; pageNum++) {
            try {
                log(`[页面进度 ${pageNum + 1}/${actualMaxPages}] 正在获取数据...`, 'info');
                
                const params = new URLSearchParams({
                    containerid: producer.producerId,
                    ...(sinceId && { since_id: sinceId.toString() })
                });

                const url = `${API_CONFIG.baseUrl}?${params.toString()}`;
                await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
                
                const content = await page.textContent('body');
                if (!content) {
                    throw new Error('页面内容为空');
                }
                
                const response: WeiboTopicResponse = JSON.parse(content);

                if (!response.ok || !response.data.cards?.length) {
                    log(`[页面进度 ${pageNum + 1}/${actualMaxPages}] 没有更多数据，结束获取`, 'info');
                    break;
                }

                sinceId = response.data.pageInfo.since_id;
                const validCards = extractType9Cards(response.data.cards);

                if (!validCards.length) {
                    log(`[页面进度 ${pageNum + 1}/${actualMaxPages}] 未找到有效帖子，继续下一页`, 'info');
                    continue;
                }

                log(`[页面进度 ${pageNum + 1}/${actualMaxPages}] 获取成功，找到 ${validCards.length} 条帖子`, 'info');

                for (let i = 0; i < validCards.length; i++) {
                    const card = validCards[i];
                    const count = await processPost(card.mblog, producer);
                    if (count > 0) {
                        log(`[页面进度 ${pageNum + 1}/${actualMaxPages}][帖子进度 ${i + 1}/${validCards.length}] 成功处理帖子 ${card.mblog.id}`, 'info');
                    }
                    totalProcessed += count;
                }

                if (!sinceId) {
                    log(`[页面进度 ${pageNum + 1}/${actualMaxPages}] 没有更多数据，结束获取`, 'info');
                    break;
                }

                if (pageNum < actualMaxPages - 1) {
                    log(`等待 ${API_CONFIG.delayMs}ms 后获取下一页...`, 'info');
                    await sleep(API_CONFIG.delayMs);
                }
            } catch (error) {
                log(`[页面进度 ${pageNum + 1}/${actualMaxPages}] 获取失败: ${error}`, 'error');
                break;
            }
        }

        log(`话题 ${producer.name || producer.producerId} 处理完成，共处理 ${totalProcessed} 条帖子`, 'info');
        
        // 更新lastPostTime
        if (totalProcessed > 0) {
            await updateProducerLastPostTime(producer.id);
            log(`已更新话题 ${producer.name || producer.producerId} 的lastPostTime`, 'info');
        }
        
        return totalProcessed;
    } finally {
        // 不需要在这里 cleanup，因为 browserManager 会复用 page
    }
};

export const processWeiboTopic = async (maxPages: number = API_CONFIG.defaultMaxPages): Promise<number> => {
    const producers = await getProducers(ProducerType.WEIBO_SUPER_TOPIC);
    log(`开始处理微博超话，共 ${producers.length} 个话题`, 'info');
    
    try {
        let totalCount = 0;
        
        for (let i = 0; i < producers.length; i++) {
            const producer = producers[i];
            log(`[总进度 ${i + 1}/${producers.length}] 开始处理话题 ${producer.name || producer.producerId}`, 'info');
            
            const count = await processTopicPost(producer, maxPages);
            totalCount += count;
            
            log(`[总进度 ${i + 1}/${producers.length}] 话题处理完成，成功处理 ${count} 条帖子`, 'info');
            
            if (i < producers.length - 1) {
                log(`等待 ${API_CONFIG.delayMs}ms 后处理下一个话题...`, 'info');
                await sleep(API_CONFIG.delayMs);
            }
        }

        log(`所有话题处理完成，共处理 ${totalCount} 条帖子`, 'success');
        return totalCount;
    } catch (error) {
        log('微博话题处理失败: ' + error, 'error');
        return 0;
    } finally {
        // 清理浏览器资源
        await browserManager.cleanup();
    }
};
