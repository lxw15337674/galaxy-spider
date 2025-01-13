import axios from 'axios';
import { type Producer, type Platform, ProducerType } from '@prisma/client';
import { sleep } from '../../utils';
import type { WeiboMblog } from './types';
import { log } from '../../utils/log';
import { createPost } from '../../db/post';
import type { PageResult } from './types';
import { getProducers, getProducerById, updateProducerLastPostTime } from '../../db/producer';

// Constants
const API_CONFIG = {
    baseUrl: 'https://m.weibo.cn/api/container/getIndex',
    headers: {
        "accept": "application/json, text/plain, */*",
        "mweibo-pwa": "1"
    },
    delayMs: 5000,
    defaultMaxPages: 20,
    postedMaxPages: 1
} as const;
    
function hasMedia(mblog: WeiboMblog): boolean {
    // 检查是否有图片
    const hasImages = (mblog.pic_ids?.length > 0) || (mblog.pics && mblog.pics.length > 0);

    // 检查是否有视频
    const hasVideo =
        (mblog.page_info?.type === "video") ||
        (mblog?.pics?.some(pic => pic?.type === "video") ?? false);

    return hasImages || hasVideo;
}

// API functions
const getContainerId = async (userId: string): Promise<string|null> => {
    try {
        const { data } = await axios.get(`${API_CONFIG.baseUrl}?type=uid&value=${userId}`);
        const containerId = data.data.tabsInfo.tabs[1].containerid;
        log(`获取到用户containerId: ${containerId}`, 'info');
        return containerId;
    } catch (error) {
        log('获取用户信息失败: ' + userId, 'error');
        return null;
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

export const processPost = async (post: WeiboMblog, producer: Producer): Promise<number> => {
    try {
        if (!hasMedia(post) ){
            log(`帖子 ${post.id} 未包含媒体，跳过`, 'info');
            return 0;
        }
        // Create post record first
        const createdPost = await createPost({
            platformId: post.id,
            platform: 'WEIBO' as Platform,
            userId: producer.producerId || '',
            producerId: producer.id,
            createTime: new Date(post.created_at)
        });
        log(`创建帖子成功: ${post.id}`, 'info');
        return createdPost ? 1 : 0;
    } catch (error) {
        log(`处理微博帖子失败: ${error}`, 'error');
        return 0;
    }
};

export const processUserPost = async (producer: Producer, maxPages: number): Promise<number> => {
    if (!producer.producerId) {
        log(`Producer ${producer.id} missing producerId`, 'error');
        return 0;
    }

    const existingProducer = await getProducerById(producer.id);
    if (!existingProducer) {
        log(`Producer ${producer.id} not found in database`, 'error');
        return 0;
    }

    // 如果有lastPostTime，则只爬取1页
    const actualMaxPages = existingProducer.lastPostTime ? Math.min(API_CONFIG.postedMaxPages, maxPages) : maxPages;
    if (existingProducer.lastPostTime) {
        log(`检测到lastPostTime，限制爬取页数为${actualMaxPages}页`, 'info');
    }

    log(`开始获取用户 ${producer.name || producer.producerId} 的containerId`, 'info');
    const containerId = await getContainerId(producer.producerId);
    if (!containerId) return 0;

    let processedCount = 0;
    let sinceId: string | undefined;

    log(`开始获取用户 ${producer.name || producer.producerId} 的微博列表，计划获取 ${actualMaxPages} 页`, 'info');
    for (let page = 0; page < actualMaxPages; page++) {
        try {
            log(`[页面进度 ${page + 1}/${actualMaxPages}] 正在获取数据...`, 'info');
            const { cards, sinceId: newSinceId } = await fetchPage(producer.producerId, containerId, sinceId);
            log(`[页面进度 ${page + 1}/${actualMaxPages}] 获取成功，包含 ${cards.length} 条微博`, 'info');
            
            let pageProcessedCount = 0;
            for (let j = 0; j < cards.length; j++) {
                const card = cards[j];
                const result = await processPost(card, producer);
                processedCount += result;
                pageProcessedCount += result;
                if (result) {
                    log(`[页面进度 ${page + 1}/${actualMaxPages}][微博进度 ${j + 1}/${cards.length}] 成功处理微博 ${card.id}`, 'info');
                }
            }

            if (!newSinceId) {
                log(`没有更多数据，结束获取`, 'info');
                break;
            }
            sinceId = newSinceId;
            await sleep(API_CONFIG.delayMs);

        } catch (error) {
            log(`[页面进度 ${page + 1}/${actualMaxPages}] 获取失败: ${error}`, 'error');
            break;
        }
    }

    log(`用户 ${producer.name || producer.producerId} 处理完成，共处理 ${processedCount} 条微博`, 'info');
    
    // 更新lastPostTime
    if (processedCount > 0) {
        await updateProducerLastPostTime(producer.id);
        log(`已更新用户 ${producer.name || producer.producerId} 的lastPostTime`, 'info');
    }
    
    return processedCount;
};

export const processWeiboPerson = async (maxPages: number = API_CONFIG.defaultMaxPages): Promise<number> => {
    let totalProcessed = 0;
    const producers = await getProducers(ProducerType.WEIBO_PERSONAL);
    log(`开始处理微博用户，共 ${producers.length} 个账号`, 'info');
    
    for (let i = 0; i < producers.length; i++) {
        const producer = producers[i];
        log(`[总进度 ${i + 1}/${producers.length}] 开始处理用户 ${producer.name || producer.producerId}`, 'info');
        const count = await processUserPost(producer, maxPages);
        totalProcessed += count;
        log(`[总进度 ${i + 1}/${producers.length}] 用户处理完成，成功处理 ${count} 条微博`, 'info');
        
        if (i < producers.length - 1) {
            log(`等待 ${API_CONFIG.delayMs}ms 后处理下一个用户...`, 'info');
            await sleep(API_CONFIG.delayMs);
        }
    }

    log(`所有用户处理完成，共处理 ${totalProcessed} 条微博`, 'info');
    return totalProcessed;
}; 
