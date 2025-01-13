import type { Browser, BrowserContext, Page } from 'playwright';
import playwright from 'playwright';

interface BrowserOptions {
    headless?: boolean;
    timeout?: number;
}

const DEFAULT_TIMEOUT = 60000; // 60 seconds

class BrowserManager {
    private browser: Browser | null = null;
    private context: BrowserContext | null = null;
    private page: Page | null = null;
    private options: Required<BrowserOptions>;

    constructor(options: BrowserOptions = {}) {
        this.options = {
            headless: true,
            timeout: DEFAULT_TIMEOUT,
            ...options
        };
    }

    async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await playwright.chromium.launch({
                headless: this.options.headless
            });
        }
        return this.browser;
    }

    async createPage(): Promise<Page> {
        if (!this.page) {
            const browser = await this.getBrowser();
            this.context = await browser.newContext();
            this.page = await this.context.newPage();
            // Set default navigation timeout
            this.page.setDefaultNavigationTimeout(this.options.timeout);
            // Set default timeout for other operations
            this.page.setDefaultTimeout(this.options.timeout);
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
