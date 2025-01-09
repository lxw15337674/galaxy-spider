

import axios from 'axios';
import { Producer, UploadStatus } from '@prisma/client';
import { Media } from '../../common/upload/type';
import { sleep } from '../../common';
import { log } from '../../utils/log';


//Constants
const API_CONFIG = {
    baseUrl: 'https://m.weibo.cn/api/container/getIndex',
    headers: {
        "accept": "application/json, text/plain, */*",
        "mweibo-pwa": "1"
    },
    delayMs: 10000,
    maxPages: 20
} as const;



const processPost = async (post: Card['mblog'], topicId: string): Promise<number> => {
    const medias: Media[] = [];
    const originSrc = `https://weibo.com/detail/${post.id}`;
    if (post.pics && post.pics.length > 0) {
        post.pics.forEach((pic) => {
            if (pic.large?.url) {
            //     medias.push({
            //         userId: topicId,
            //         postId: post.id,
            //         originMediaUrl: pic.large.url,
            //         createTime: new Date(post.created_at),
            //         width: parseInt(pic.large.geo.width),
            //         height: parseInt(pic.large.geo.height),
            //         originSrc,
            //         status: UploadStatus.PENDING
                    medias.push({
                        userId: topicId,
                        postId: post.id,
                        originMediaUrl: pic.large.url,
                        createTime: new Date(post.created_at),
                        width: parseInt(pic.large.geo.width),
                        height: parseInt(pic.large.geo.height),
                        originSrc,
                        status: UploadStatus.PENDING
                    });
                }
            });
        }

        if (medias.length > 0) {
            await saveMedias(medias);
        return medias.length;
    }

    return 0;
};

export const processWeiboTopic = async (producers: Producer[]): Promise<void> => {
    try {
        log('==== 开始微博话题数据获取 ====');

        for (const producer of producers) {
            if (!producer.weiboTopicIds?.length) {
                log(`生产者 ${producer.name} 未找到话题ID，跳过`, 'warn');
                continue;
            }

            log(`\n👤 处理生产者: ${producer.name} (${producer.id})`);

            for (const topicId of producer.weiboTopicIds) {
                let totalProcessed = 0;
                let sinceId: string | undefined;

                for (let page = 0; page < API_CONFIG.maxPages; page++) {
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

                        for (const card of validCards) {
                            try {
                                const count = await processPost(card.mblog, topicId);
                                if (count > 0) {
                                    totalProcessed += count;
                                    log(`处理微博 ${card.mblog.id} 成功，获取到 ${count} 个媒体文件`);
                                }
                            } catch (error) {
                                log(`处理微博失败: ${error}`, 'error');
                            }
                        }

                        await sleep(API_CONFIG.delayMs);
                        if (!sinceId) break;
                    } catch (error) {
                        log(`获取话题页面失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
                        break;
                    }
                }

                log(`话题 ${topicId} 处理完成，共处理 ${totalProcessed} 个媒体文件`, 'success');
            }
        }

        log('\n==== 微博话题数据获取完成 ====', 'success');
    } catch (error) {
        log('微博话题处理失败: ' + error, 'error');
    }
};


const producer: Producer[] = [{
    name: "测试话题",
    id: "123456",
    weiboTopicIds: ["100808fa2e191f05c4e748d06033886dad8048"],
    weiboIds: [],
    xiaohongshuIds: [],
    douyinIds: [],
    weiboChaohua: null,
    createTime: new Date(),
    updateTime: new Date(),
    deletedAt: null
}]

processWeiboTopic(producer);

