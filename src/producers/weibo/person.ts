import { type Producer, type Platform, ProducerType } from '@prisma/client';
import { type Page } from 'playwright';
import { sleep } from '../../utils';
import type { WeiboMblog } from './types';
import { log } from '../../utils/log';
import { createPost } from '../../db/post';
import type { PageResult } from './types';
import { getProducers, getProducerById, updateProducerLastPostTime } from '../../db/producer';
import { browserManager } from '../../browser';
import { getCachedCookies } from '../../utils/cookie';
import { config } from '../../config';

// Constants
const API_CONFIG = {
    baseUrl: 'https://weibo.cn',
    delayMs: 5000,
    defaultMaxPages: 20,
    postedMaxPages: 1,
    maxCookieRefreshPerUser: 2 // 每个用户最多刷新 Cookie 的次数
} as const;

// Cookie 缓存
let cachedCookies: any[] | null = null;

/**
 * 解析微博时间文本（中文格式）
 * 例如："今天 14:30"、"1小时前"、"01月12日 22:30"、"2023-12-25 10:00:00"、"2025-12-31 18:42:16 来自邱笛尔超话"
 */
function parseWeiboTime(timeText: string): Date {
    try {
        const now = new Date();
        
        // 移除多余空格
        timeText = timeText.trim();
        
        // 移除 "来自xxx" 后缀（微博来源信息）
        timeText = timeText.replace(/\s+来自.+$/, '');
        
        // 格式1: "X分钟前"
        const minutesMatch = timeText.match(/(\d+)分钟前/);
        if (minutesMatch) {
            const minutes = parseInt(minutesMatch[1]);
            return new Date(now.getTime() - minutes * 60 * 1000);
        }
        
        // 格式2: "X小时前"
        const hoursMatch = timeText.match(/(\d+)小时前/);
        if (hoursMatch) {
            const hours = parseInt(hoursMatch[1]);
            return new Date(now.getTime() - hours * 60 * 60 * 1000);
        }
        
        // 格式3: "今天 HH:MM"
        const todayMatch = timeText.match(/今天\s+(\d{1,2}):(\d{2})/);
        if (todayMatch) {
            const hour = parseInt(todayMatch[1]);
            const minute = parseInt(todayMatch[2]);
            const date = new Date(now);
            date.setHours(hour, minute, 0, 0);
            return date;
        }
        
        // 格式4: "MM月DD日 HH:MM" (今年)
        const thisYearMatch = timeText.match(/(\d{1,2})月(\d{1,2})日\s+(\d{1,2}):(\d{2})/);
        if (thisYearMatch) {
            const month = parseInt(thisYearMatch[1]) - 1; // 月份从0开始
            const day = parseInt(thisYearMatch[2]);
            const hour = parseInt(thisYearMatch[3]);
            const minute = parseInt(thisYearMatch[4]);
            const date = new Date(now.getFullYear(), month, day, hour, minute, 0, 0);
            return date;
        }
        
        // 格式5: 标准日期格式 "YYYY-MM-DD HH:MM:SS"
        const standardDate = new Date(timeText);
        if (!isNaN(standardDate.getTime())) {
            return standardDate;
        }
        
        // 无法解析，返回当前时间
        log(`无法解析时间文本: "${timeText}"，使用当前时间`, 'warn');
        return now;
        
    } catch (error) {
        log(`解析时间失败: ${error}，使用当前时间`, 'error');
        return new Date();
    }
}

/**
 * 检测错误是否是 Cookie 失效/登录问题
 */
function isLoginError(error: any): boolean {
    const errorStr = String(error).toLowerCase();
    const loginKeywords = [
        '扫描二维码',
        '扫码登录',
        '登录',
        'login',
        '请登录',
        '验证',
        'not valid json',
        'unexpected token'
    ];
    
    return loginKeywords.some(keyword => errorStr.includes(keyword));
}

/**
 * 清除 Cookie 缓存，强制下次重新获取
 */
function clearCookieCache(): void {
    cachedCookies = null;
    log('已清除 Cookie 缓存', 'info');
}
    
function hasMedia(mblog: WeiboMblog): boolean {
    // 检查是否有图片
    const hasImages = (mblog.pic_ids?.length > 0) || (mblog.pics && mblog.pics.length > 0);

    // 检查是否有视频
    const hasVideo =
        (mblog.page_info?.type === "video") ||
        (mblog?.pics?.some(pic => pic?.type === "video") ?? false);

    return hasImages || hasVideo;
}

// 解析HTML提取微博数据
const parseWeiboFromHtml = async (page: Page): Promise<WeiboMblog[]> => {
    try {
        const content = await page.content();
        
        // 检查是否需要登录
        if (content.includes('请登录') || content.includes('登录')) {
            log('页面需要登录', 'warn');
            return [];
        }
        
        // 使用 page.evaluate 在浏览器环境中解析
        const weibos = await page.evaluate(() => {
            const result: any[] = [];
            const divs = document.querySelectorAll('div.c');
            
            divs.forEach((div) => {
                const idAttr = div.getAttribute('id');
                if (!idAttr || !idAttr.startsWith('M_')) return;
                
                const weiboId = idAttr.substring(2);
                
                // 提取发布时间
                const timeSpan = div.querySelector('span.ct');
                const timeText = timeSpan?.textContent || '';
                
                // 提取内容
                const contentSpan = div.querySelector('span.ctt');
                const contentText = contentSpan?.textContent || '';
                
                // 检查是否有图片
                const picLinks = div.querySelectorAll('a[href*="/mblog/picAll/"]');
                const hasPics = picLinks.length > 0;
                
                // 检查是否有视频
                const videoLinks = div.querySelectorAll('a[href*="video"]');
                const hasVideo = videoLinks.length > 0;
                
                if (hasPics || hasVideo) {
                    result.push({
                        id: weiboId,
                        created_at: timeText,
                        text: contentText,
                        pic_ids: hasPics ? ['pic'] : [],
                        page_info: hasVideo ? { type: 'video' } : undefined
                    });
                }
            });
            
            return result;
        });
        
        return weibos as WeiboMblog[];
    } catch (error) {
        log('解析HTML失败: ' + error, 'error');
        return [];
    }
};

const fetchPage = async (userId: string, pageNum: number, page: Page): Promise<PageResult> => {
    const url = `${API_CONFIG.baseUrl}/${userId}/profile?page=${pageNum}`;
    log(`正在访问URL: ${url}`, 'info');
    
    const response = await page.goto(url, { 
        waitUntil: 'networkidle',  // 等待网络请求完成
        timeout: 60000 
    });
    
    if (response?.status() !== 200) {
        throw new Error(`请求失败，状态码: ${response?.status()}`);
    }
    
    // 额外等待页面完全渲染
    await page.waitForTimeout(2000);
    
    // 解析页面获取微博数据
    const cards = await parseWeiboFromHtml(page);
    
    // 检查是否有下一页
    const hasNextPage = await page.evaluate(() => {
        const pageDiv = document.querySelector('div#pagelist');
        if (!pageDiv) return false;
        const links = Array.from(pageDiv.querySelectorAll('a'));
        return links.some(link => link.textContent?.includes('下页'));
    });
    
    return {
        cards,
        sinceId: hasNextPage ? String(pageNum + 1) : ''
    };
};

export const processPost = async (post: WeiboMblog, producer: Producer): Promise<number> => {
    try {
        if (!hasMedia(post) ){
            log(`帖子 ${post.id} 未包含媒体，跳过`, 'info');
            return 0;
        }
        
        if (!config.shouldWriteDB) {
            log(`${config.logPrefix} 发现有媒体的帖子: ${post.id}`, 'info');
            return 1;
        }
        
        // 使用 producer.producerId 作为 userId，因为从 HTML 解析的数据没有 user 信息
        const userId = post.user?.id?.toString() || producer.producerId || '';
        
        // 解析微博时间
        const createTime = parseWeiboTime(post.created_at);
        
        const createdPost = await createPost({
            platformId: post.id,
            platform: 'WEIBO' as Platform,
            userId: userId,
            producerId: producer.id,
            createTime: createTime
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

    const existingProducer = config.useTestData 
        ? producer 
        : await getProducerById(producer.id);
        
    if (!existingProducer) {
        log(`Producer ${producer.id} not found in database`, 'error');
        return 0;
    }

    // 如果有lastPostTime，则只爬取1页
    const actualMaxPages = existingProducer.lastPostTime ? Math.min(API_CONFIG.postedMaxPages, maxPages) : maxPages;
    if (existingProducer.lastPostTime) {
        log(`检测到lastPostTime，限制爬取页数为${actualMaxPages}页`, 'info');
    }

    // 创建 page 实例
    const page = await browserManager.createPage();
    
    // 设置 Cookie
    try {
        if (!cachedCookies) {
            log('正在获取微博 Cookie...', 'info');
            cachedCookies = await getCachedCookies();
            log(`成功获取 ${cachedCookies.length} 个 Cookie`, 'info');
        }
        await page.context().addCookies(cachedCookies);
        log('Cookie 设置成功', 'info');
    } catch (error) {
        log(`Cookie 设置失败: ${error}`, 'error');
        throw error;
    }

    try {
        let processedCount = 0;
        let cookieRefreshCount = 0; // 记录该用户已刷新 Cookie 的次数

        log(`开始获取用户 ${producer.name || producer.producerId} 的微博列表，计划获取 ${actualMaxPages} 页`, 'info');
        for (let pageNum = 1; pageNum <= actualMaxPages; pageNum++) {
            let pageRetryCount = 0;
            const maxPageRetry = 2;
            let pageSuccess = false;
            let currentPageCards: any[] = [];
            let currentPageHasNext = false;
            
            while (pageRetryCount < maxPageRetry && !pageSuccess) {
                try {
                    const retryInfo = pageRetryCount > 0 ? ` (重试 ${pageRetryCount}/${maxPageRetry - 1})` : '';
                    log(`[页面进度 ${pageNum}/${actualMaxPages}] 正在获取数据...${retryInfo}`, 'info');
                    const { cards, sinceId: hasNextPage } = await fetchPage(producer.producerId, pageNum, page);
                    log(`[页面进度 ${pageNum}/${actualMaxPages}] 获取成功，包含 ${cards.length} 条微博`, 'info');
                    
                    currentPageCards = cards;
                    currentPageHasNext = !!hasNextPage;
                    pageSuccess = true;
                    
                } catch (error) {
                    const isLogin = isLoginError(error);
                    
                    if (isLogin) {
                        log(`[页面进度 ${pageNum}/${actualMaxPages}] 检测到 Cookie 失效: ${error}`, 'error');
                        
                        if (cookieRefreshCount < API_CONFIG.maxCookieRefreshPerUser) {
                            cookieRefreshCount++;
                            log(`[页面进度 ${pageNum}/${actualMaxPages}] 尝试刷新 Cookie (${cookieRefreshCount}/${API_CONFIG.maxCookieRefreshPerUser})...`, 'info');
                            
                            clearCookieCache();
                            try {
                                cachedCookies = await getCachedCookies();
                                await page.context().clearCookies();
                                await page.context().addCookies(cachedCookies);
                                log(`[页面进度 ${pageNum}/${actualMaxPages}] Cookie 刷新成功，准备重试`, 'success');
                                await sleep(2000);
                            } catch (cookieError) {
                                log(`[页面进度 ${pageNum}/${actualMaxPages}] Cookie 刷新失败: ${cookieError}`, 'error');
                                break;
                            }
                        } else {
                            log(`[页面进度 ${pageNum}/${actualMaxPages}] 已达到最大 Cookie 刷新次数，跳过该页面`, 'error');
                            break;
                        }
                    } else {
                        log(`[页面进度 ${pageNum}/${actualMaxPages}] 获取失败 (非登录问题): ${error}`, 'error');
                        if (pageRetryCount === 0) {
                            log(`[页面进度 ${pageNum}/${actualMaxPages}] 等待 2 秒后重试...`, 'info');
                            await sleep(2000);
                        } else {
                            break;
                        }
                    }
                    
                    pageRetryCount++;
                }
            }
            
            // 处理成功获取的数据
            if (pageSuccess) {
                let pageProcessedCount = 0;
                for (let j = 0; j < currentPageCards.length; j++) {
                    const card = currentPageCards[j];
                    const result = await processPost(card, producer);
                    processedCount += result;
                    pageProcessedCount += result;
                    if (result) {
                        log(`[页面进度 ${pageNum}/${actualMaxPages}][微博进度 ${j + 1}/${currentPageCards.length}] 成功处理微博 ${card.id}`, 'info');
                    }
                }

                if (!currentPageHasNext) {
                    log(`没有更多数据，结束获取`, 'info');
                    break;
                }
                
                if (pageNum < actualMaxPages) {
                    await sleep(API_CONFIG.delayMs);
                }
            } else {
                log(`[页面进度 ${pageNum}/${actualMaxPages}] 该页面获取失败，继续处理下一页`, 'warn');
            }
        }

        log(`用户 ${producer.name || producer.producerId} 处理完成，共处理 ${processedCount} 条微博`, 'info');
        
        if (processedCount > 0 && !config.useTestData) {
            await updateProducerLastPostTime(producer.id);
            log(`已更新用户 ${producer.name || producer.producerId} 的lastPostTime`, 'info');
        }
        
        return processedCount;
    } finally {
        // 不需要在这里 cleanup，因为 browserManager 会复用 page
    }
};

export const processWeiboPerson = async (maxPages: number = API_CONFIG.defaultMaxPages): Promise<number> => {
    let totalProcessed = 0;
    
    const producers = config.useTestData 
        ? [
            {
                id: 'test-user-1',
                name: '测试用户',
                producerId: '5286960038',
                type: 'WEIBO_PERSONAL' as ProducerType,
                lastPostTime: null,
                createTime: new Date(),
                updateTime: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            }
          ]
        : await getProducers(ProducerType.WEIBO_PERSONAL);
    
    log(`${config.logPrefix} 开始处理微博用户，共 ${producers.length} 个账号`, 'info');
    
    try {
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
    } finally {
        // 清理浏览器资源
        await browserManager.cleanup();
    }
}; 
