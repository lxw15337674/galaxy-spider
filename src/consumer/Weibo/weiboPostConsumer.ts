import { UploadStatus } from '@prisma/client';
import { browserManager } from '../../browser';
import { getPendingPost, updatePostStatus } from '../../db/post';
import { uploadToGallery } from '../../utils/upload/upload';
import type { WeiboData } from '../types';
import { saveMedias } from '../../db/media';
import { downloadVideo } from '../../utils/downloadVideo';

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
export const getWeiboPost = async (id: string) => {
    let context = null;
    try {
        const browser = await browserManager.getBrowser();
        context = await browser.newContext();
        const page = await context.newPage();

        const postUrl = `https://m.weibo.cn/detail/${id}`;
        // 导航到微博帖子页面
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
    } finally {
        // 确保上下文被关闭
        if (context) {
            await context.close();
        }
    }
};

export const runWeiboPostConsumer = async () => {
    const post = await getPendingPost();
    if (!post) {
        return;
    }
    // 获取微博帖子数据
    const data = await getWeiboPost(post.platformId);
    // const data = await getWeiboPost('5120079876328548');
    if (!data) {
        return;
    }
    const { medias } = data;
  
    // 保存图片到gallery
    const mediaUrls = medias.map(media => media.originMediaUrl);
    for(const mediaUrl of mediaUrls){
        const result = await uploadToGallery(mediaUrl,{
            Host: 'wx3.sinaimg.cn',
            Referer: 'https://weibo.com/'
        });
        console.log(result)
    }

    // await saveMedias(results.map((url, index) => ({
    //     galleryMediaUrl: url,
    //     originMediaUrl: medias[index].originMediaUrl,
    //     postId: post.id,
    //     originSrc: medias[index].originSrc,
    //     userId: post.userId,
    //     width: medias[index].width,
    //     height: medias[index].height,
    // })));
    // 更新post状态
    // if (!medias.length) {
    //     await updatePostStatus(post.id, UploadStatus.UPLOADED);
    //     return;
    // }
};