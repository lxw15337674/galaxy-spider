import { browserManager } from '../browser';
import type { WeiboData } from './types';


function extractMediaUrls(data: WeiboData): { images: string[]; videos: string[] } {
    const images: string[] = [];
    const videos: string[] = [];

    if (data.status && data.status.pics) {
        data.status.pics.forEach((pic) => {
            if (pic.type === "video" && pic.videoSrc) {
                // 如果是视频，提取视频URL
                videos.push(pic.videoSrc);
            } else {
                // 如果是图片，提取高清图片URL（如果存在）
                images.push(pic.large?.url || pic.url);
            }
        });
    }

    return { images, videos };
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

        // 导航到微博帖子页面
        await page.goto(`https://m.weibo.cn/detail/${id}`, { waitUntil: 'networkidle' });

        // 提取 $render_data
        const renderData =  await page.evaluate(() => {
            return (window as any).$render_data
        });
        const { images, videos } = extractMediaUrls(renderData);
        return { images, videos };
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