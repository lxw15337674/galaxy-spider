import { UploadStatus } from '@prisma/client';
import { browserManager } from '../../browser';
import { saveMedias } from '../../db/media';
import { getPendingPost, updatePostStatus } from '../../db/post';
import { uploadToGallery } from '../../utils/upload/upload';
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
            if (!data?.status?.pics) return null;

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
                    videoSrc: video.media_info?.stream_url_hd || video.media_info?.stream_url
                });
            }
            return data;
        });

        if (!renderData) {
            console.error(`❌ 无效的数据格式: ${id}`);
            return null;
        }

        const medias = extractMedias(renderData, postUrl);
        return { medias };
    } catch (error) {
        console.error(`❌ 数据获取失败: ${id}`, error);
        return null;
    }
};

export const runWeiboPostConsumer = async () => {
    console.log('🚀 微博帖子消费者启动...');
    let processedCount = 0;
    const startTime = new Date();
    
    try {
        const page = await browserManager.getPage();
        console.log('✅ 浏览器页面初始化完成');

        while (true) {
            const post = await getPendingPost();
            if (!post) {
                const endTime = new Date();
                const duration = (endTime.getTime() - startTime.getTime()) / 1000;
                console.log(`✨ 没有待处理的帖子了`);
                console.log(`📊 总计处理: ${processedCount} 个帖子, 耗时: ${duration.toFixed(1)}秒`);
                break;
            }

            const postStartTime = new Date();
            console.log(`\n📝 [${++processedCount}] 正在处理平台 ID: ${post.platformId}`);

            try {
                const data = await getWeiboPost(post.platformId, page);
                if (!data) {
                    console.log(`❌ 获取帖子数据失败，ID: ${post.platformId}`);
                    await updatePostStatus(post.id, UploadStatus.FAILED);
                    continue;
                }
                const { medias } = data;
                console.log(`📸 发现 ${medias.length} 个媒体文件需要处理`);

                // 保存图片到gallery
                const mediaUrls = medias.map(media => media.originMediaUrl);
                const results: string[] = [];
                let successCount = 0;
                
                // Sequential upload
                for (const [index, mediaUrl] of mediaUrls.entries()) {
                    console.log(`⬆️ 正在上传第 ${index + 1}/${mediaUrls.length} 个媒体文件到图库...`);
                    const result = await uploadToGallery(mediaUrl, {
                        Referer: 'https://weibo.com/'
                    });
                    if (result !== null) {
                        results.push(result);
                        successCount++;
                        console.log(`✅ 第 ${index + 1} 个媒体文件上传成功 (${successCount}/${mediaUrls.length})`);
                    } else {
                        console.log(`⚠️ 第 ${index + 1} 个媒体文件上传失败 (${successCount}/${mediaUrls.length})`);
                    }
                }
                
                console.log(`💾 正在保存 ${results.length} 个媒体记录到数据库...`);
                await saveMedias(results.map((url, index) => ({
                    galleryMediaUrl: url,
                    originMediaUrl: medias[index].originMediaUrl,
                    postId: post.id,
                    originSrc: medias[index].originSrc,
                    userId: post.userId,
                    producerId: post.producerId,
                    width: medias[index].width,
                    height: medias[index].height,
                    status: UploadStatus.UPLOADED
                })));

                await updatePostStatus(post.id, UploadStatus.UPLOADED);
                const postEndTime = new Date();
                const postDuration = (postEndTime.getTime() - postStartTime.getTime()) / 1000;
                console.log(`✅ 帖子处理完成，ID: ${post.id}，耗时: ${postDuration.toFixed(1)}秒`);
            } catch (error) {
                console.error(`❌ 处理帖子失败，ID: ${post.id}:`, error);
                await updatePostStatus(post.id, UploadStatus.FAILED);
            }
        }
    } finally {
        console.log('🧹 正在清理浏览器资源...');
        await browserManager.cleanup();
        const endTime = new Date();
        const totalDuration = (endTime.getTime() - startTime.getTime()) / 1000;
        console.log(`👋 微博帖子消费者结束运行，总计处理: ${processedCount} 个帖子，总耗时: ${totalDuration.toFixed(1)}秒`);
    }
};