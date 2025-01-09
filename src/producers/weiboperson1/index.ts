import axios, { AxiosError } from 'axios';
import { Producer, UploadStatus } from '@prisma/client';
import { Media } from '../../common/upload/type';
import { sleep } from '../../common';
import { WeiboMblog } from '../../types/weibo';
import { log } from '../../utils/log';
import { saveMedias } from '../../common/db/media';
import { PageResult, PicItem } from './types';

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


// Utility functions
const handleError = (error: unknown, context: string): never => {
    const msg = error instanceof AxiosError ? error.message : '未知错误';
    log(`${context}: ${msg}`, 'error');
    throw error;
};

const convertPicsToArray = (pics: any): PicItem[] => {
    if (Array.isArray(pics)) return pics;
    return Object.entries(pics)
        .filter(([key]) => key !== '')
        .map(([_, value]) => value as PicItem)
        .filter(item => item.large?.url || item.videoSrc);
};

// API functions
const getContainerId = async (userId: string): Promise<string|null> => {
    try {
        const { data } = await axios.get(`${API_CONFIG.baseUrl}?type=uid&value=${userId}`);
        const containerId = data.data.tabsInfo.tabs[1].containerid;
        log(`获取到用户containerId: ${containerId}`, 'info');
        return containerId;
    } catch (error) {
        handleError(error, '获取用户信息失败');
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

const processPost = async (post: WeiboMblog, userId: string): Promise<number> => {
    const pics = post?.pics || [];
    const originSrc = `https://weibo.com/${userId}/${post.bid}`;

    if (!pics || (typeof pics === 'object' && Object.keys(pics).length === 0)) {
        log(`没有图片，跳过,源链接: ${originSrc}`, 'warn');
        return 0;
    }

    const picsArray = convertPicsToArray(pics);
    if (picsArray.length === 0) {
        log('没有有效的图片，跳过', 'warn');
        return 0;
    }

    const medias: Media[] = picsArray.map((pic, i) => ({
        userId,
        postId: post.id,
        originMediaUrl: pic.videoSrc || pic.large.url,
        createTime: new Date(post.created_at || Date.now()),
        width: Number(pic.large.geo.width),
        height: Number(pic.large.geo.height),
        originSrc,
        status: UploadStatus.PENDING
    }));

    await saveMedias(medias);
    return medias.length;
};

const processUserPosts = async (userId: string): Promise<number> => {
    let totalProcessed = 0;
    let sinceId: string | undefined;

    try {
        const containerId = await getContainerId(userId);
        if(!containerId) {
            log(`未找到用户 ${userId} 的containerId，跳过`, 'warn');
            return 0;
        }
        for (let page = 0; page < API_CONFIG.maxPages; page++) {
            try {
                const { cards, sinceId: newSinceId } = await fetchPage(userId, containerId, sinceId);

                if (!cards.length) {
                    log('没有更多微博数据', 'info');
                    break;
                }

                sinceId = newSinceId;
                log(`成功获取第 ${page + 1} 页微博`, 'success');

                for (const post of cards) {
                    try {
                        totalProcessed += await processPost(post, userId);
                    } catch (error) {
                        log(`处理单条微博失败: ${error}`, 'error');
                    }
                }

                await sleep(API_CONFIG.delayMs);
            } catch (error) {
                log(`获取第 ${page + 1} 页微博失败: ${error}`, 'error');
                break;
            }
        }
    } catch (error) {
        log('获取微博列表失败', 'error');
    }

    return totalProcessed;
};

export const processWeibo = async (producers: Producer[]): Promise<void> => {
    try {
        log('==== 开始微博数据获取 ====');
        log(`总共有 ${producers.length} 个生产者需要处理`);

        for (const producer of producers) {
            if (producer.weiboIds.length === 0) {
                log(`生产者 ${producer.name} 未找到微博ID，跳过`, 'warn');
                continue;
            }

            log(`\n👤 处理生产者: ${producer.name} (${producer.id})`);
            log(`📋 找到 ${producer.weiboIds.length} 个微博ID待处理`);

            for (const userId of producer.weiboIds) {
                try {
                    log(`\n🔄 开始处理用户 ${userId} 的微博`);
                    const processedCount = await processUserPosts(userId);
                    log(`用户 ${userId} 处理完成，共处理 ${processedCount} 张图片`, 'success');
                } catch (error) {
                    log(`用户 ${userId} 处理失败: ${error}`, 'error');
                }
            }
        }
        
        log('\n==== 微博数据获取完成 ====', 'success');
    } catch (error) {
        log('微博处理主函数出错: ' + error, 'error');
    }
}; 
