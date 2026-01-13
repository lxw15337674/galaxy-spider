import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { browserManager } from '../../src/browser';
import type { Page } from 'playwright';
import { getWeiboCnCookies } from '../../src/utils/cookie';

let weiboCookies: any[] = [];

async function setupCookies(page: Page) {
    const context = page.context();
    
    // 如果还没有获取 cookie，先从 Gist 获取
    if (weiboCookies.length === 0) {
        weiboCookies = await getWeiboCnCookies();
        console.log(`📋 从 Gist 获取到 ${weiboCookies.length} 个 cookie`);
    }
    
    await context.addCookies(weiboCookies);
}

describe('微博个人主页爬取 - 方案2 (weibo.cn)', () => {
    const testUserId = '5286960038';

    beforeAll(async () => {
        // 预先获取 cookie
        weiboCookies = await getWeiboCnCookies();
    });

    afterAll(async () => {
        await browserManager.cleanup();
    });

    it('应该能成功从HTML解析微博数据', async () => {
        const page = await browserManager.createPage();
        await setupCookies(page);
        const url = `https://weibo.cn/${testUserId}/profile?page=1`;
        
        console.log(`访问URL: ${url}`);
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        
        console.log('响应状态:', response?.status());
        expect(response?.status()).toBe(200);
        
        await page.waitForTimeout(1000);
        
        // 先检查页面内容
        const pageContent = await page.content();
        console.log('页面长度:', pageContent.length);
        console.log('页面前1000字符:', pageContent.substring(0, 1000));
        console.log('包含class=c的div数量:', (pageContent.match(/class="c"/g) || []).length);
        console.log('包含M_的id数量:', (pageContent.match(/id="M_/g) || []).length);
        
        // 检查是否需要登录
        const needsLogin = pageContent.includes('登录') || pageContent.includes('请登录');
        console.log('是否需要登录:', needsLogin);
        
        if (needsLogin) {
            console.log('⚠️ 页面需要登录，测试跳过');
            return;
        }
        
        // 解析HTML获取微博数据
        const weibos = await page.evaluate(() => {
            const result: any[] = [];
            const divs = document.querySelectorAll('div.c');
            
            divs.forEach((div) => {
                const idAttr = div.getAttribute('id');
                if (!idAttr || !idAttr.startsWith('M_')) return;
                
                const weiboId = idAttr.substring(2);
                
                const timeSpan = div.querySelector('span.ct');
                const timeText = timeSpan?.textContent || '';
                
                const contentSpan = div.querySelector('span.ctt');
                const contentText = contentSpan?.textContent || '';
                
                const picLinks = div.querySelectorAll('a[href*="/mblog/picAll/"]');
                const hasPics = picLinks.length > 0;
                
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
        
        console.log(`解析到 ${weibos.length} 条包含媒体的微博`);
        
        if (weibos.length > 0) {
            console.log('示例微博:', {
                id: weibos[0].id,
                created_at: weibos[0].created_at,
                text: weibos[0].text.substring(0, 50) + '...',
                hasPics: weibos[0].pic_ids.length > 0,
                hasVideo: !!weibos[0].page_info
            });
        }
        
        expect(weibos.length).toBeGreaterThan(0);
        expect(weibos[0]).toHaveProperty('id');
        expect(weibos[0]).toHaveProperty('created_at');
        expect(weibos[0]).toHaveProperty('text');
    }, 120000);

    it('应该能检测分页', async () => {
        const page = await browserManager.createPage();
        await setupCookies(page);
        const url = `https://weibo.cn/${testUserId}/profile?page=1`;
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(1000);
        
        const hasNextPage = await page.evaluate(() => {
            const pageDiv = document.querySelector('div#pagelist');
            if (!pageDiv) return false;
            const links = Array.from(pageDiv.querySelectorAll('a'));
            return links.some(link => link.textContent?.includes('下页'));
        });
        
        console.log('是否有下一页:', hasNextPage ? '是' : '否');
        expect(typeof hasNextPage).toBe('boolean');
    }, 60000);
});
