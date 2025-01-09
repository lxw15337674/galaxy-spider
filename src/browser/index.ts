import type { Browser } from 'playwright';
import { chromium } from 'playwright';
import { log } from '../utils/log';

class BrowserManager {
    private static instance: BrowserManager;
    private browser: Browser | null = null;

    private constructor() {}

    static getInstance(): BrowserManager {
        if (!BrowserManager.instance) {
            BrowserManager.instance = new BrowserManager();
        }
        return BrowserManager.instance;
    }

    async getBrowser(): Promise<Browser> {
        if (!this.browser) {
            this.browser = await chromium.launch({
                headless: true
            });
        }
        log('Browser launched');
        return this.browser;
    }

    async closeBrowser(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

export const browserManager = BrowserManager.getInstance();
