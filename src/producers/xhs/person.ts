import { type Producer, type Platform, ProducerType } from '@prisma/client';
import { type Page } from 'playwright';
import { sleep } from '../../utils';
import { log } from '../../utils/log';
import { createPost } from '../../db/post';
import { getProducers, getProducerById, updateProducerLastPostTime } from '../../db/producer';
import { browserManager } from '../../browser';
import { config } from '../../config';

const API_CONFIG = {
    delayMs: 2000,
    defaultMaxPages: 5,
    postedMaxPages: 5,
    maxScrollAttempts: 12
} as const;

type XhsNoteCover = {
    url?: string;
    url_pre?: string;
    url_default?: string;
    info_list?: { url: string }[];
};

type XhsNote = {
    note_id: string;
    display_title?: string;
    cover?: XhsNoteCover;
    user?: {
        user_id?: string;
    };
};

type XhsUserPostedResponse = {
    success: boolean;
    msg?: string;
    code?: number;
    data?: {
        cursor?: string;
        notes?: XhsNote[];
        has_more?: boolean;
    };
};

function buildProfileUrl(producerId: string): { userId: string; url: string } {
    if (producerId.startsWith('http')) {
        try {
            const parsed = new URL(producerId);
            const parts = parsed.pathname.split('/').filter(Boolean);
            const profileIndex = parts.findIndex(p => p === 'profile');
            const userId = profileIndex >= 0 ? parts[profileIndex + 1] : parts[parts.length - 1];
            return { userId, url: producerId };
        } catch {
            return { userId: producerId, url: producerId };
        }
    }
    return {
        userId: producerId,
        url: `https://www.xiaohongshu.com/user/profile/${producerId}`
    };
}

function extractCoverUrl(note: XhsNote): string | null {
    const cover = note.cover;
    if (!cover) return null;
    return (
        cover.url_default ||
        cover.url_pre ||
        cover.url ||
        cover.info_list?.[0]?.url ||
        null
    );
}

const collectUserPostedResponses = async (page: Page, maxPages: number): Promise<XhsUserPostedResponse[]> => {
    const results: XhsUserPostedResponse[] = [];
    const seenCursors = new Set<string>();

    const handler = async (response: any) => {
        const url = response.url();
        if (!url.includes('/api/sns/web/v1/user_posted')) {
            return;
        }
        if (response.status() !== 200) {
            return;
        }
        try {
            const json = (await response.json()) as XhsUserPostedResponse;
            const cursor = json.data?.cursor || '';
            if (seenCursors.has(cursor)) {
                return;
            }
            seenCursors.add(cursor);
            results.push(json);
        } catch {
            // ignore parse errors
        }
    };

    page.on('response', handler);

    let attempts = 0;
    while (results.length < maxPages && attempts < API_CONFIG.maxScrollAttempts) {
        await page.mouse.wheel(0, 1200);
        await page.waitForTimeout(800);
        attempts++;
    }

    page.off('response', handler);
    return results.slice(0, maxPages);
};

export const processXhsPerson = async (maxPages: number = API_CONFIG.defaultMaxPages): Promise<number> => {
    let totalProcessed = 0;

    const envProducerId = process.env.XHS_TEST_PRODUCER_ID;
    const producers = envProducerId
        ? [
            {
                id: 'xhs-env-test',
                name: 'XHS_ENV_TEST',
                producerId: envProducerId,
                type: 'XIAOHONGSHU_PERSONAL' as ProducerType,
                lastPostTime: null,
                createTime: new Date(),
                updateTime: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                deletedAt: null
            }
          ]
        : config.useTestData
            ? [
                {
                    id: 'test-xhs-1',
                    name: '测试小红书用户',
                    producerId: '68b97e22000000001a00d834',
                    type: 'XIAOHONGSHU_PERSONAL' as ProducerType,
                    lastPostTime: null,
                    createTime: new Date(),
                    updateTime: new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    deletedAt: null
                }
              ]
            : await getProducers(ProducerType.XIAOHONGSHU_PERSONAL);

    log(`${config.logPrefix} 开始处理小红书用户，共 ${producers.length} 个账号`, 'info');

    try {
        for (let i = 0; i < producers.length; i++) {
            const producer = producers[i];
            log(`[总进度 ${i + 1}/${producers.length}] 开始处理用户 ${producer.name || producer.producerId}`, 'info');

            const count = await processUserPost(producer, maxPages);
            totalProcessed += count;
            log(`[总进度 ${i + 1}/${producers.length}] 用户处理完成，成功处理 ${count} 条笔记`, 'info');

            if (i < producers.length - 1) {
                log(`等待 ${API_CONFIG.delayMs}ms 后处理下一个用户...`, 'info');
                await sleep(API_CONFIG.delayMs);
            }
        }

        log(`所有小红书用户处理完成，共处理 ${totalProcessed} 条笔记`, 'info');
        return totalProcessed;
    } finally {
        await browserManager.cleanup();
    }
};

export const processUserPost = async (producer: Producer, maxPages: number): Promise<number> => {
    if (!producer.producerId) {
        log(`Producer ${producer.id} missing producerId`, 'error');
        return 0;
    }

    const envProducerId = process.env.XHS_TEST_PRODUCER_ID;
    const existingProducer = envProducerId
        ? producer
        : config.useTestData
            ? producer
            : await getProducerById(producer.id);
        
    if (!existingProducer) {
        log(`Producer ${producer.id} not found in database`, 'error');
        return 0;
    }

    const actualMaxPages = envProducerId
        ? maxPages
        : existingProducer.lastPostTime
            ? Math.min(API_CONFIG.postedMaxPages, maxPages)
            : maxPages;
    if (existingProducer.lastPostTime) {
        log(`检测到lastPostTime，限制爬取页数为${actualMaxPages}页`, 'info');
    }

    const { userId, url } = buildProfileUrl(producer.producerId);

    const page = await browserManager.createPage({ storageStatePath: process.env.XHS_STORAGE_STATE_PATH || 'xhs.storage.json' });

    try {
        log(`打开用户主页: ${url}`, 'info');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

        const responses = await collectUserPostedResponses(page, actualMaxPages);
        if (!responses.length) {
            log('未捕获到笔记列表接口响应', 'warn');
            return 0;
        }

        let processedCount = 0;
        let pageIndex = 0;

        for (const response of responses) {
            pageIndex++;
            const notes = response.data?.notes || [];
            log(`[页面进度 ${pageIndex}/${actualMaxPages}] 获取成功，包含 ${notes.length} 条笔记`, 'info');

            for (let j = 0; j < notes.length; j++) {
                const note = notes[j];
                const coverUrl = extractCoverUrl(note);
                if (!coverUrl) {
                    log(`笔记 ${note.note_id} 未包含图片，跳过`, 'info');
                    continue;
                }

                if (!config.shouldWriteDB) {
                    log(`${config.logPrefix} 发现有图片的笔记: ${note.note_id}`, 'info');
                    processedCount += 1;
                    continue;
                }

                try {
                    const createdPost = await createPost({
                        platformId: String(note.note_id),
                        platform: 'XIAOHONGSHU' as Platform,
                        userId: note.user?.user_id || userId,
                        producerId: producer.id,
                        createTime: new Date()
                    });
                    if (createdPost) {
                        processedCount += 1;
                        log(`[页面进度 ${pageIndex}/${actualMaxPages}][笔记进度 ${j + 1}/${notes.length}] 成功处理笔记 ${note.note_id}`, 'info');
                    }
                } catch (error) {
                    log(`处理小红书笔记失败: ${error}`, 'error');
                }
            }
        }

        if (processedCount > 0 && !config.useTestData) {
            await updateProducerLastPostTime(producer.id);
            log(`已更新用户 ${producer.name || producer.producerId} 的lastPostTime`, 'info');
        }

        return processedCount;
    } catch (error) {
        log(`小红书用户处理失败: ${error}`, 'error');
        return 0;
    }
};
