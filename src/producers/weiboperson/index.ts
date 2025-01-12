import axios from 'axios';
import type { Producer, Platform, ProducerType, UploadStatus } from '@prisma/client';
import { sleep } from '../../utils';
import type { WeiboMblog } from '../../types/weibo';
import { log } from '../../utils/log';
import { createPost } from '../../db/post';
import { saveMedias } from '../../db/media';
import type { PageResult } from './types';

// Constants
const API_CONFIG = {
    baseUrl: 'https://m.weibo.cn/api/container/getIndex',
    headers: {
        "accept": "application/json, text/plain, */*",
        "mweibo-pwa": "1"
    },
    delayMs: 10000,
    maxPages: 20
} as const;



// API functions
const getContainerId = async (userId: string): Promise<string|null> => {
    try {
        const { data } = await axios.get(`${API_CONFIG.baseUrl}?type=uid&value=${userId}`);
        const containerId = data.data.tabsInfo.tabs[1].containerid;
        log(`获取到用户containerId: ${containerId}`, 'info');
        return containerId;
    } catch (error) {
        log( '获取用户信息失败');
        return null
    }
};

const fetchPage = async (userId: string, containerId: string, sinceId?: string): Promise<PageResult> => {
    const params = {
        type: "uid",
        value: userId,
        containerid: containerId,
        ...(sinceId && { since_id: sinceId })
    };

    const { data } = await axios.get(API_CONFIG.baseUrl, {
        params,
        headers: API_CONFIG.headers
    });

    return {
        cards: data.data.cards
            .filter((card: any) => card.card_type === 9)
            .map((card: any) => card.mblog),
        sinceId: data.data.cardlistInfo.since_id
    };
};

const processPost = async (post: WeiboMblog, producer: Producer): Promise<number> => {
    try {
        // Create post record first
        const createdPost = await createPost({
            platformId: post.id,
            platform: 'WEIBO' as Platform,
            userId: producer.producerId || ''
        });

        // Then create media records
        const medias = post.pics?.map(pic => ({
            width: pic.geo?.width || null,
            height: pic.geo?.height || null,
            originSrc: `https://m.weibo.cn/${producer.producerId}/${post.id}`,
            originMediaUrl: pic.large?.url || pic.url,
            galleryMediaUrl: null,
            userId: producer.producerId || '',
            producerId: producer.id,
            postId: createdPost.id
        })) || [];

        if (medias.length > 0) {
            await saveMedias(medias);
        }

        return 1;
    } catch (error) {
        log(`处理微博帖子失败: ${error}`, 'error');
        return 0;
    }
};

const processUserPosts = async (producer: Producer, maxPages: number): Promise<number> => {
    if (!producer.producerId) {
        log(`Producer ${producer.id} missing producerId`, 'error');
        return 0;
    }

    log(`开始获取用户 ${producer.name || producer.producerId} 的containerId`, 'info');
    const containerId = await getContainerId(producer.producerId);
    if (!containerId) return 0;

    let processedCount = 0;
    let sinceId: string | undefined;

    log(`开始获取用户 ${producer.name || producer.producerId} 的微博列表，计划获取 ${maxPages} 页`, 'info');
    for (let page = 0; page < maxPages; page++) {
        try {
            log(`正在获取第 ${page + 1} 页数据...`, 'info');
            const { cards, sinceId: newSinceId } = await fetchPage(producer.producerId, containerId, sinceId);
            log(`第 ${page + 1} 页获取成功，包含 ${cards.length} 条微博`, 'info');
            
            let pageProcessedCount = 0;
            for (const card of cards) {
                if (card.mblog) {
                    const result = await processPost(card.mblog, producer);
                    processedCount += result;
                    pageProcessedCount += result;
                    if (result) {
                        log(`成功处理微博 ${card.mblog.id}`, 'info');
                    }
                }
            }

            // 如果这一页所有微博都已存在，则停止爬取
            if (cards.length > 0 && pageProcessedCount === 0) {
                log(`当前页面所有微博都已存在，停止爬取`, 'info');
                break;
            }

            if (!newSinceId) {
                log(`没有更多数据，结束获取`, 'info');
                break;
            }
            sinceId = newSinceId;
            await sleep(API_CONFIG.delayMs);

        } catch (error) {
            log(`获取第${page + 1}页失败: ${error}`, 'error');
            break;
        }
    }

    log(`用户 ${producer.name || producer.producerId} 处理完成，共处理 ${processedCount} 条微博`, 'info');
    return processedCount;
};

export const processWeiboPerson = async (producers: Producer[], maxPages: number = API_CONFIG.maxPages): Promise<number> => {
    let totalProcessed = 0;

    for (const producer of producers) {
        if (producer.type !== 'WEIBO_PERSONAL') {
            continue;
        }

        log(`开始处理 ${producer.name || producer.producerId}`, 'info');
        const count = await processUserPosts(producer, maxPages);
        totalProcessed += count;
        log(`处理完成，成功处理 ${count} 条微博`, 'info');
        await sleep(API_CONFIG.delayMs);
    }

    return totalProcessed;
}; 
