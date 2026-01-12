/**
 * Cookie 管理工具
 * 从 GitHub Gist 获取和管理 Cookie
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
const GIST_ID = process.env.GIST_ID || '';

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
 * 从 Gist 获取 weibo.cn 可用的 Cookie
 */
export async function getWeiboCnCookies(): Promise<PlaywrightCookie[]> {
    // 从 Gist 获取 weibo.com 的 cookie
    const cookies = await fetchCookiesFromGist('weibo.com');
    
    // 转换为 weibo.cn 域名的 Playwright cookie
    return convertToPlaywrightCookies(cookies, '.weibo.cn');
}

/**
 * 将 Cookie 数组转换为字符串格式（用于 HTTP headers）
 */
export function cookiesToString(cookies: CookieItem[]): string {
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
}
