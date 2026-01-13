/**
 * Cookie 管理工具
 * 从 GitHub Gist 获取和管理 Cookie
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GIST_ID = process.env.GIST_ID;

if (!GITHUB_TOKEN || !GIST_ID) {
    throw new Error('缺少必要的环境变量: GITHUB_TOKEN 和 GIST_ID 必须在 .env 文件中配置');
}

// 全局 Cookie 缓存
let cookieCache: PlaywrightCookie[] | null = null;

export interface CookieItem {
    name: string;
    value: string;
    domain?: string;
    path?: string;
    expires?: number;
    expirationDate?: number;
    httpOnly?: boolean;
    secure?: boolean;
    sameSite?: string;
}

export interface PlaywrightCookie {
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
}

/**
 * 从 GitHub Gist 获取 Cookie 数据
 */
export async function fetchCookiesFromGist(sourceDomain: string = 'weibo.com'): Promise<CookieItem[]> {
    try {
        const apiUrl = `https://api.github.com/gists/${GIST_ID}`;
        
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            }
        });
        
        if (!response.ok) {
            throw new Error(`GitHub API 请求失败: ${response.status} ${response.statusText}`);
        }
        
        const data = await response.json();
        const files = data.files as any;
        
        // 查找 cookie 文件
        for (const [filename, fileInfo] of Object.entries(files)) {
            if (filename.toLowerCase().includes('cookie') || filename.toLowerCase().includes('sync-your-cookie')) {
                const content = fileInfo.content;
                if (content) {
                    const cookieData = JSON.parse(content);
                    const domainCookieMap = cookieData.domainCookieMap || {};
                    
                    // 查找指定域名的 cookie
                    if (domainCookieMap[sourceDomain]) {
                        const cookies = domainCookieMap[sourceDomain].cookies || [];
                        console.log(`✅ 从 Gist 获取到 ${cookies.length} 个 ${sourceDomain} cookie`);
                        return cookies;
                    }
                }
            }
        }
        
        throw new Error(`未在 Gist 中找到 ${sourceDomain} 的 Cookie`);
    } catch (error) {
        console.error('❌ 从 Gist 获取 Cookie 失败:', error);
        throw error;
    }
}

/**
 * 将 Cookie 转换为 Playwright 格式，并修改域名
 */
export function convertToPlaywrightCookies(
    cookies: CookieItem[],
    targetDomain: string
): PlaywrightCookie[] {
    return cookies.map(c => {
        // 处理 sameSite 值
        let sameSite: 'Strict' | 'Lax' | 'None' = 'Lax';
        if (c.sameSite === 'strict') sameSite = 'Strict';
        else if (c.sameSite === 'none' || c.sameSite === 'no_restriction') sameSite = 'None';
        
        return {
            name: c.name,
            value: c.value,
            domain: targetDomain,
            path: c.path || '/',
            expires: c.expirationDate || c.expires || -1,
            httpOnly: c.httpOnly || false,
            secure: c.secure || false,
            sameSite
        };
    });
}

/**
 * 获取 weibo 通用 Cookie（支持多个子域名）
 */
export async function getWeiboCnCookies(): Promise<PlaywrightCookie[]> {
    // 从 Gist 获取 weibo.com 的 cookie
    const cookies = await fetchCookiesFromGist('weibo.com');
    
    // 同时转换为 .weibo.cn 和 .weibo.com 域名，覆盖所有子域名
    return [
        ...convertToPlaywrightCookies(cookies, '.weibo.cn'),
        ...convertToPlaywrightCookies(cookies, '.weibo.com')
    ];
}

/**
 * 获取缓存的 Cookie，如果没有则从 Gist 获取
 */
export async function getCachedCookies(): Promise<PlaywrightCookie[]> {
    if (!cookieCache) {
        console.log('📥 从 Gist 获取 Cookie...');
        cookieCache = await getWeiboCnCookies();
        console.log(`✅ 成功获取 ${cookieCache.length} 个 Cookie`);
    }
    return cookieCache;
}

/**
 * 清除 Cookie 缓存（刷新时使用）
 */
export function clearCookieCache(): void {
    cookieCache = null;
    console.log('🗑️ Cookie 缓存已清除');
}

/**
 * 将 Cookie 数组转换为字符串格式（用于 HTTP headers）
 */
export function cookiesToString(cookies: CookieItem[]): string {
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}

/**
 * 验证 Cookie 是否有效
 * 通过访问微博并检查是否被重定向到登录页来判断
 */
export async function validateCookies(): Promise<boolean> {
    const { chromium } = await import('playwright');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    
    try {
        // 获取并添加 Cookie
        const cookies = await getWeiboCnCookies();
        await context.addCookies(cookies);
        
        const page = await context.newPage();
        
        // 访问微博首页
        const response = await page.goto('https://weibo.cn/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        
        const finalUrl = page.url();
        
        // 检查是否被重定向到登录页
        const isRedirectedToLogin = finalUrl.includes('login') || 
                                    finalUrl.includes('passport') ||
                                    finalUrl.includes('signin');
        
        if (isRedirectedToLogin) {
            console.log('❌ Cookie 已失效（被重定向到登录页）');
            await browser.close();
            return false;
        }
        
        // 检查页面内容是否包含登录相关元素
        const pageContent = await page.content();
        const hasLoginKeywords = pageContent.includes('登录') && 
                                 !pageContent.includes('退出') &&
                                 !pageContent.includes('首页');
        
        if (hasLoginKeywords) {
            console.log('❌ Cookie 已失效（页面显示需要登录）');
            await browser.close();
            return false;
        }
        
        console.log('✅ Cookie 验证通过，当前已登录');
        await browser.close();
        return true;
        
    } catch (error) {
        console.error('❌ Cookie 验证过程出错:', error);
        await browser.close();
        return false;
    }
}

/**
 * 更新 Cookie 到 GitHub Gist
 */
export async function updateCookiesToGist(cookies: PlaywrightCookie[]): Promise<void> {
    try {
        // 转换为 CookieItem 格式
        const cookieItems: CookieItem[] = cookies
            .filter(c => c.domain.includes('weibo'))
            .map(c => ({
                name: c.name,
                value: c.value,
                domain: c.domain,
                path: c.path,
                expirationDate: c.expires,
                httpOnly: c.httpOnly,
                secure: c.secure,
                sameSite: c.sameSite === 'Strict' ? 'strict' : 
                         c.sameSite === 'None' ? 'no_restriction' : 'lax'
            }));
        
        // 构造 Gist 数据格式
        const gistData = {
            domainCookieMap: {
                'weibo.com': {
                    cookies: cookieItems
                }
            }
        };
        
        const apiUrl = `https://api.github.com/gists/${GIST_ID}`;
        
        const response = await fetch(apiUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: {
                    'sync-your-cookie.json': {
                        content: JSON.stringify(gistData, null, 2)
                    }
                }
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GitHub API 更新失败: ${response.status} ${errorText}`);
        }
        
        console.log(`✅ 成功更新 ${cookieItems.length} 个 Cookie 到 Gist`);
        
    } catch (error) {
        console.error('❌ 更新 Cookie 到 Gist 失败:', error);
        throw error;
    }
}

/**
 * 刷新并验证 Cookie
 * 主流程：拉取 → 验证 → 提取刷新后的 Cookie → 推送
 */
export async function refreshAndValidateCookies(): Promise<boolean> {
    const { chromium } = await import('playwright');
    
    console.log('🔄 开始 Cookie 刷新流程...');
    
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    
    try {
        // 1. 从 Gist 获取 Cookie
        console.log('📥 从 Gist 拉取 Cookie...');
        const cookies = await getWeiboCnCookies();
        await context.addCookies(cookies);
        
        // 2. 访问微博验证 Cookie 有效性
        console.log('🔍 验证 Cookie 有效性...');
        const page = await context.newPage();
        const response = await page.goto('https://weibo.cn/', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });
        
        const finalUrl = page.url();
        const isRedirectedToLogin = finalUrl.includes('login') || 
                                    finalUrl.includes('passport') ||
                                    finalUrl.includes('signin');
        
        if (isRedirectedToLogin) {
            console.log('❌ Cookie 已失效，无法刷新');
            await browser.close();
            return false;
        }
        
        console.log('✅ Cookie 有效');
        
        // 3. 提取浏览器当前的 Cookie（可能被服务器刷新了）
        console.log('📤 提取并更新 Cookie...');
        const refreshedCookies = await context.cookies();
        
        // 4. 推送到 Gist
        await updateCookiesToGist(refreshedCookies);
        
        // 5. 清除缓存，强制下次重新获取
        clearCookieCache();
        
        console.log('✅ Cookie 刷新流程完成');
        await browser.close();
        return true;
        
    } catch (error) {
        console.error('❌ Cookie 刷新流程失败:', error);
        await browser.close();
        throw error;
    }
}
