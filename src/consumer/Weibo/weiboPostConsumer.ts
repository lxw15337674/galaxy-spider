import { UploadStatus } from '@prisma/client';
import { browserManager } from '../../browser';
import { saveMedias } from '../../db/media';
import { getPendingPost, updatePostStatus } from '../../db/post';
import { uploadToGallery } from '../../utils/upload';
import { log } from '../../utils/log';
import type { WeiboData } from './types';
import type { Page } from 'playwright';

interface MediaInfo {
    width: number | null;
    height: number | null;
    originMediaUrl: string;
    originSrc: string;
    type: 'image' | 'video';
}

function extractMedias(data: WeiboData, postUrl: string): MediaInfo[] {
    const medias: MediaInfo[] = [];

    if (data.status && data.status.pics) {
        data.status.pics.forEach(async (pic) => {
            if (pic.type === "video" && pic.videoSrc) {
                medias.push({
                    width: pic.geo?.width || null,
                    height: pic.geo?.height || null,
                    originMediaUrl: pic.videoSrc,
                    originSrc: postUrl,
                    type: 'video'
                });
            } else {
                const imageUrl = pic.large?.url || pic.url;
                medias.push({
                    width: (pic.large?.geo?.width || pic.geo?.width || null) as number | null,
                    height: (pic.large?.geo?.height || pic.geo?.height || null) as number | null,
                    originMediaUrl: imageUrl,
                    originSrc: postUrl,
                    type: 'image'
                });
            }
        });
    }

    return medias;
}

/**
 * 获取微博帖子的渲染数据
 * @param id 微博帖子ID
 * @returns 微博帖子的渲染数据，如果获取失败则返回 null
 */
export const getWeiboPost = async (id: string, page: Page) => {
    try {
        const postUrl = `https://m.weibo.cn/detail/${id}`;
        await page.goto(postUrl, { waitUntil: 'networkidle' });

        // 提取 $render_data
        const renderData = await page.evaluate(() => {
            const data = (window as any).$render_data as WeiboData;
            // 处理视频信息
            if (data.status.page_info?.type === 'video') {
                const video = data.status.page_info;
                data.status.pics = data.status.pics || [];
                data.status.pics.push({
                    pid: video.page_pic?.pid || '',
                    url: video.page_pic?.url || '',
                    size: 'video',
                    geo: {
                        width: parseInt(video.page_pic?.width) || 0,
                        height: parseInt(video.page_pic?.height) || 0,
                        croped: false
                    },
                    large: {
                        size: 'video',
                        url: video.page_pic?.url || '',
                        geo: {
                            width: parseInt(video.page_pic?.width) || 0,
                            height: parseInt(video.page_pic?.height) || 0,
                            croped: false
                        }
                    },
                    type: 'video',
                    videoSrc: video.media_info?.stream_url_hd || video.media_info?.stream_url || Object.values(video.urls ||{})[0]
                });
            }
            return data;
        });

        if (!renderData) {
            log(`无效的数据格式: ${id}`, 'error');
            return null;
        }

        const medias = extractMedias(renderData, postUrl);
        return { medias, postUrl };
    } catch (error) {
        log(`数据获取失败: ${id}: ${error}`, 'error');
        return null;
    }
};

export const runWeiboPostConsumer = async () => {
    log('🚀 微博帖子消费者启动...', 'info');
    let processedCount = 0;
    const startTime = new Date();
    
    try {
        const page = await browserManager.createPage();
        log('浏览器页面初始化完成', 'success');

        while (true) {
            const post = await getPendingPost();
            if (!post) {
                const endTime = new Date();
                const duration = (endTime.getTime() - startTime.getTime()) / 1000;
                log(`没有待处理的帖子了`, 'success');
                log(`总计处理: ${processedCount} 个帖子, 耗时: ${duration.toFixed(1)}秒`, 'info');
                break;
            }

            const postStartTime = new Date();
            log(`[${++processedCount}] 正在处理平台 ID: ${post.platformId}`, 'info');

            try {
                const data = await getWeiboPost(post.platformId, page);
                if (!data) {
                    log(`获取帖子数据失败，ID: ${post.platformId}`, 'error');
                    await updatePostStatus(post.id, UploadStatus.FAILED);
                    continue;
                }
                await updatePostStatus(post.id, UploadStatus.PROCESSING);
                const { medias, postUrl } = data;
                // 保存图片到gallery
                const mediaUrls = medias.map(media => media.originMediaUrl);
                let successCount = 0;
                
                // Concurrent upload
                log(`开始并发上传 ${mediaUrls.length} 个媒体文件到图库...`, 'info');
                const uploadPromises = mediaUrls.map((mediaUrl, index) => 
                    uploadToGallery(mediaUrl, {
                        Referer: 'https://weibo.com/'
                    }).then(result => {
                        if (result !== null) {
                            successCount++;
                            log(`第 ${index + 1} 个媒体文件上传成功 (${successCount}/${mediaUrls.length})`, 'success');
                        } else {
                            log(`第 ${index + 1} 个媒体文件上传失败 (${successCount}/${mediaUrls.length})`, 'warn');
                        }
                        return result;
                    })
                );

                const results = (await Promise.all(uploadPromises)).filter((url): url is string => url !== null);
                
                await saveMedias(results.map((url, index) => ({
                    galleryMediaUrl: url,
                    originMediaUrl: medias[index].originMediaUrl,
                    postId: post.id,
                    originSrc: medias[index].originSrc,
                    userId: post.userId,
                    producerId: post.producerId,
                    width: medias[index].width,
                    height: medias[index].height,
                    status: UploadStatus.UPLOADED,
                    createTime: post.createTime
                })));

                await updatePostStatus(post.id, UploadStatus.UPLOADED);
                const postEndTime = new Date();
                const postDuration = (postEndTime.getTime() - postStartTime.getTime()) / 1000;
                log(`帖子处理完成，源地址: ${postUrl} ，耗时: ${postDuration.toFixed(1)}秒`, 'success');
            } catch (error) {
                log(`处理帖子失败，ID: ${post.id}: ${error}`, 'error');
                await updatePostStatus(post.id, UploadStatus.FAILED);
            }
        }
    } finally {
        log('正在清理浏览器资源...', 'info');
        await browserManager.cleanup();
        const endTime = new Date();
        const totalDuration = (endTime.getTime() - startTime.getTime()) / 1000;
        log(`微博帖子消费者结束运行，总计处理: ${processedCount} 个帖子，总耗时: ${totalDuration.toFixed(1)}秒`, 'info');
    }
};