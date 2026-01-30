import { Browser, BrowserContext, Page } from 'playwright';
import playwright from 'playwright';
import { resolveStorageStatePath } from '../utils/storageState';

class BrowserManager {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;

    async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await playwright.chromium.launch({
                headless: true,
            });
        }
        return this.browser;
    }

    async createPage(): Promise<Page> {
        const browser = await this.getBrowser();
        // 每次都创建新的 context 和 page，避免并发冲突
        if (this.context) {
            await this.context.close();
        }
        const resolvedStorageStatePath = await resolveStorageStatePath();
        const contextOptions = resolvedStorageStatePath
            ? { storageState: resolvedStorageStatePath }
            : {};
        this.context = await browser.newContext(contextOptions);
        if (!resolvedStorageStatePath) {
            console.log('⚠️ 未找到 storageState，可能会触发登录要求');
        }
        return await this.context.newPage();
    }

    async cleanup() {
        if (this.context) {
            await this.context.close();
            this.context = null;
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
