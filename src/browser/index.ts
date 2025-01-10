import { Browser, BrowserContext, Page } from 'playwright';
import playwright from 'playwright';

class BrowserManager {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;

    async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await playwright.chromium.launch({
                headless: true
            });
        }
        return this.browser;
    }

    async getPage(): Promise<Page> {
        if (!this.page) {
            const browser = await this.getBrowser();
            this.context = await browser.newContext();
            this.page = await this.context.newPage();
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
}

export const browserManager = new BrowserManager();
