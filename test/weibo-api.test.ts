import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { browserManager } from '../src/browser';
import type { Page } from 'playwright';

const WEIBO_COOKIES = '';

async function setupCookies(page: Page) {
    const context = page.context();
    
    const parseCookies = (domain: string) => {
        return WEIBO_COOKIES.split(';').map(cookie => {
            const [name, value] = cookie.trim().split('=');
            return { name, value, domain, path: '/' };
        });
    };
    
    await context.addCookies([
        ...parseCookies('.weibo.cn'),
        ...parseCookies('.weibo.com'),
        ...parseCookies('passport.weibo.com')
    ]);
}

describe('微博API测试', () => {
    let page: Page;
    const testUserId = '5286960038';

    beforeAll(async () => {
        page = await browserManager.createPage();
        await setupCookies(page);
    });

    afterAll(async () => {
        await browserManager.cleanup();
    });

    it('应该能访问公共话题页面', async () => {
        await page.goto('https://m.weibo.cn/p/index?extparam=hot&page_type=hot&containerid=100803_cfb1fb5070925f438556e849f4a3f58f8b4f36_-_feed&luicode=10000011&lfid=231583', 
            { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(3000);
        const title = await page.title();
        
        expect(title).toBeTruthy();
    }, 60000);

    it('应该能访问微博首页', async () => {
        await page.goto('https://m.weibo.cn/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        const title = await page.title();
        
        expect(title).toBeTruthy();
        
        const content = await page.textContent('body');
        const isLoggedIn = !content?.includes('登录') && !content?.includes('请登录');
        
        console.log(isLoggedIn ? '✓ 已登录' : '⚠ 需要登录');
    }, 60000);

    it('应该能通过API获取用户containerId', async () => {
        const url = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${testUserId}`;
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const content = await page.textContent('body');
        expect(content).toBeTruthy();
        
        const data = JSON.parse(content!);
        expect(data.ok).toBe(1);
        expect(data.data?.tabsInfo?.tabs).toBeDefined();
        
        console.log('用户tabs:', data.data?.tabsInfo?.tabs?.map((t: any) => t.title));
    }, 60000);

    it('应该能获取用户微博列表', async () => {
        // 先获取containerId
        const url1 = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${testUserId}`;
        await page.goto(url1, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const content1 = await page.textContent('body');
        const data1 = JSON.parse(content1!);
        const containerId = data1.data?.tabsInfo?.tabs?.[1]?.containerid;
        
        expect(containerId).toBeTruthy();
        console.log('containerId:', containerId);
        
        // 获取微博列表 - 使用 page.evaluate 拦截响应
        await page.waitForTimeout(2000);
        const url2 = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${testUserId}&containerid=${containerId}`;
        
        const response = await page.goto(url2, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // 检查响应状态
        console.log('响应状态:', response?.status());
        console.log('响应URL:', response?.url());
        
        // 尝试直接从响应获取内容
        let content2: string | null = null;
        if (response) {
            try {
                content2 = await response.text();
                console.log('响应长度:', content2?.length);
                console.log('响应前200字符:', content2?.substring(0, 200));
            } catch (error) {
                console.log('获取响应文本失败:', error);
            }
        }
        
        // 如果响应为空，尝试从页面获取
        if (!content2 || content2.trim() === '') {
            await page.waitForTimeout(3000);
            content2 = await page.textContent('body');
            console.log('页面body长度:', content2?.length);
        }
        
        expect(content2).toBeTruthy();
        
        const data2 = JSON.parse(content2!);
        expect(data2.ok).toBe(1);
        
        const mblogs = data2.data?.cards?.filter((card: any) => card.card_type === 9);
        expect(mblogs).toBeDefined();
        
        console.log(`✓ 获取到 ${mblogs?.length || 0} 条微博`);
    }, 60000);

    it('应该能访问用户个人主页', async () => {
        const userUrl = `https://weibo.com/u/${testUserId}`;
        await page.goto(userUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        const title = await page.title();
        expect(title).toBeTruthy();
        
        const content = await page.textContent('body');
        const needsLogin = content?.includes('登录') || content?.includes('请登录');
        
        console.log(needsLogin ? '⚠ 需要登录' : '✓ 无需登录');
    }, 60000);

    it('方案1: 应该能通过 weibo.com Ajax API 获取用户微博', async () => {
        const url = `https://weibo.com/ajax/statuses/searchProfile?uid=${testUserId}&page=1&hasori=1&hastext=1&haspic=1&hasvideo=1`;
        
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log('响应状态:', response?.status());
        console.log('响应URL:', response?.url());
        
        let content: string | null = null;
        if (response) {
            content = await response.text();
            console.log('响应长度:', content?.length);
            console.log('响应前300字符:', content?.substring(0, 300));
        }
        
        if (!content) {
            await page.waitForTimeout(2000);
            content = await page.textContent('body');
        }
        
        expect(content).toBeTruthy();
        
        const data = JSON.parse(content!);
        console.log('数据结构:', Object.keys(data));
        
        if (data.ok === 1 || data.data) {
            const list = data.data?.list || data.list;
            console.log(`✓ 成功获取 ${list?.length || 0} 条微博`);
            
            if (list && list.length > 0) {
                console.log('第一条微博:', {
                    id: list[0].id || list[0].mid,
                    text: list[0].text_raw?.substring(0, 50) || list[0].text?.substring(0, 50),
                    created_at: list[0].created_at
                });
            }
            
            expect(list).toBeDefined();
        } else {
            console.log('完整响应数据:', data);
        }
    }, 60000);

    it('方案2: 应该能通过 weibo.cn 移动版获取用户微博', async () => {
        const url = `https://weibo.cn/${testUserId}/profile?page=1`;
        
        const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log('响应状态:', response?.status());
        console.log('响应URL:', response?.url());
        
        await page.waitForTimeout(2000);
        
        const content = await page.content();
        console.log('页面内容长度:', content?.length);
        console.log('页面前500字符:', content?.substring(0, 500));
        
        expect(content).toBeTruthy();
        
        // 检查是否需要登录
        const needsLogin = content?.includes('登录') || content?.includes('请登录');
        console.log(needsLogin ? '⚠ 需要登录' : '✓ 无需登录');
        
        // 尝试查找微博内容
        const hasMblog = content?.includes('class="c"') || content?.includes('class="ctt"');
        console.log(hasMblog ? '✓ 找到微博内容结构' : '✗ 未找到微博内容结构');
        
        // 检查是否有分页
        const hasPagination = content?.includes('下页') || content?.includes('page=');
        console.log(hasPagination ? '✓ 有分页' : '⚠ 无分页');
    }, 60000);

    it('无Cookie测试 - 方案1: weibo.com Ajax API', async () => {
        // 创建新页面，不设置Cookie
        const newPage = await browserManager.createPage();
        
        const url = `https://weibo.com/ajax/statuses/searchProfile?uid=${testUserId}&page=1&hasori=1&hastext=1&haspic=1&hasvideo=1`;
        const response = await newPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log('[无Cookie] 响应状态:', response?.status());
        
        const content = await response?.text();
        console.log('[无Cookie] 响应:', content?.substring(0, 200));
    }, 60000);

    it('无Cookie测试 - 方案2: weibo.cn 移动版', async () => {
        // 创建新页面，不设置Cookie
        const newPage = await browserManager.createPage();
        
        const url = `https://weibo.cn/${testUserId}/profile?page=1`;
        const response = await newPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        console.log('[无Cookie] 响应状态:', response?.status());
        
        await newPage.waitForTimeout(2000);
        const content = await newPage.content();
        
        console.log('[无Cookie] 页面长度:', content?.length);
        
        const needsLogin = content?.includes('登录') || content?.includes('请登录');
        console.log('[无Cookie]', needsLogin ? '⚠ 需要登录' : '✓ 无需登录');
        
        const hasMblog = content?.includes('class="c"') || content?.includes('class="ctt"');
        console.log('[无Cookie]', hasMblog ? '✓ 找到微博内容' : '✗ 未找到微博内容');
    }, 60000);

    it('验证方案2的HTML解析逻辑', async () => {
        const newPage = await browserManager.createPage();
        const url = `https://weibo.cn/${testUserId}/profile?page=1`;
        
        await newPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await newPage.waitForTimeout(1000);
        
        // 使用与person.ts相同的解析逻辑
        const weibos = await newPage.evaluate(() => {
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
                        hasPics,
                        hasVideo
                    });
                }
            });
            
            return result;
        });
        
        console.log(`解析到 ${weibos.length} 条包含媒体的微博`);
        
        if (weibos.length > 0) {
            console.log('第一条微博:', {
                id: weibos[0].id,
                text: weibos[0].text.substring(0, 50),
                hasPics: weibos[0].hasPics,
                hasVideo: weibos[0].hasVideo
            });
        }
        
        expect(weibos.length).toBeGreaterThan(0);
    }, 60000);
});
