import { Browser, BrowserContext, Page } from 'playwright';
import playwright from 'playwright';

class BrowserManager {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await playwright.chromium.launch({
                headless: true,
            });
        }
        return this.browser;
    }

    async createPage(): Promise<Page> {
        if (!this.page) {
            const browser = await this.getBrowser();
            this.context = await browser.newContext({
            });
            this.page = await this.context.newPage();

            // 先访问微博首页建立会话
            await this.page.goto('https://m.weibo.cn/', { waitUntil: 'domcontentloaded' });
            // 可能需要等待一下，让页面完全加载
            await this.page.waitForTimeout(1000);
        }
        return this.page;
    }

    async cleanup() {
        if (this.context) {
            await this.context.close();
            this.context = null;
            this.page = null;
        }
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    async closeBrowser() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

export const browserManager = new BrowserManager();
