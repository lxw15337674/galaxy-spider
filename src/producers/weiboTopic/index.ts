import axios from 'axios';
import type { Producer } from '@prisma/client';
import { sleep } from '../../utils';
import { log } from '../../utils/log';
import { createPost } from '../../db/post';

//Constants
const API_CONFIG = {
    baseUrl: 'https://m.weibo.cn/api/container/getIndex',
    headers: {
        "accept": "application/json, text/plain, */*",
    },
    delayMs: 10000,
    maxPages: 20
} as const;

export const processWeiboTopic = async (producers: Producer[],maxPages:number=API_CONFIG.maxPages): Promise<number> => {
    try {
        log('==== 开始获取微博话题帖子 ====');
        let totalCount = 0;
        
        // 计算总任务数
        const totalTopics = producers.reduce((sum, producer) => 
            sum + (producer.weiboTopicIds?.length || 0), 0);
        let completedTopics = 0;

        for (const producer of producers) {
            if (!producer.weiboTopicIds?.length) {
                log(`生产者 ${producer.name} 未找到话题ID，跳过`, 'warn');
                continue;
            }

            log(`\n👤 处理生产者: ${producer.name} (${producer.id})`);

            for (const topicId of producer.weiboTopicIds) {
                let totalProcessed = 0;
                let sinceId: string | undefined;
                
                log(`开始处理话题 ${topicId} (${++completedTopics}/${totalTopics})`);
                
                for (let page = 0; page < maxPages; page++) {
                    try {
                        const response = await axios.get<any>(API_CONFIG.baseUrl, {
                            params: {
                                containerid: topicId,
                                ...(sinceId && { since_id: sinceId })
                            },
                            headers: API_CONFIG.headers
                        });

                        if (!response.data.ok || !response.data.data.cards?.length) break;

                        sinceId = response.data.data.pageInfo.since_id;
                        const validCards = response.data.data.cards.filter((card: any) =>
                            card.card_type === '9' && card.mblog
                        );

                        if (!validCards.length) continue;

                        log(`正在处理第 ${page + 1} 页，共找到 ${validCards.length} 条帖子`);

                        for (const card of validCards) {
                            try {
                                const post = card.mblog;
                                if (post.pics?.length) {
                                    await createPost({
                                        platform: 'WEIBO',
                                        userId: String(card.mblog.user.id),
                                        platformId: post.id,
                                    });
                                    
                                    totalProcessed += post.pics.length;
                                    totalCount += post.pics.length;
                                    log(`已保存帖子 ${post.id}，包含 ${post.pics.length} 张图片`);
                                }
                            } catch (error) {
                                log(`保存帖子失败: ${error}`, 'error');
                            }
                        }

                        await sleep(API_CONFIG.delayMs);
                        if (!sinceId) break;
                    } catch (error) {
                        log(`获取话题页面失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
                        break;
                    }
                }

                const remainingTopics = totalTopics - completedTopics;
                log(`话题 ${topicId} 处理完成，共保存 ${totalProcessed} 张有图片的帖子 (还剩 ${remainingTopics} 个话题)`, 'success');
            }
        }

        log(`\n==== 微博话题帖子获取完成，共处理 ${totalCount} 张图片 ====`, 'success');
        return totalCount;
    } catch (error) {
        log('微博话题处理失败: ' + error, 'error');
        return 0;
    }
};
