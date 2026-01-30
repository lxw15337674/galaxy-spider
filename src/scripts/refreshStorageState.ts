/**
 * StorageState 刷新脚本
 * 打开浏览器完成登录后导出 storageState 并上传到 Gist
 */

import { chromium } from 'playwright';
import readline from 'node:readline';
import { updateStorageStateToGist } from '../utils/storageState';

const storageStatePath = process.env.STORAGE_STATE_PATH || 'weibo.storage.json';
const loginUrl = process.env.WEIBO_LOGIN_URL || 'https://weibo.com/';
const waitMs = Number(process.env.LOGIN_WAIT_MS || 180000);

async function waitForUserOrTimeout(): Promise<void> {
    if (process.stdin.isTTY) {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        await new Promise<void>(resolve => {
            rl.question('请完成登录后按回车继续...\n', () => {
                rl.close();
                resolve();
            });
        });
        return;
    }

    await new Promise(resolve => setTimeout(resolve, waitMs));
}

async function main() {
    console.log('==========================================');
    console.log('🔄 StorageState 刷新任务');
    console.log('==========================================\n');

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext();

    try {
        const page = await context.newPage();
        await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
        console.log(`已打开登录页面: ${loginUrl}`);
        await waitForUserOrTimeout();

        await context.storageState({ path: storageStatePath });
        console.log(`✅ storageState 已保存到 ${storageStatePath}`);

        await updateStorageStateToGist(storageStatePath);
        console.log('✅ storageState 已上传到 Gist');
    } finally {
        await context.close();
        await browser.close();
    }
}

main().catch(error => {
    console.error('❌ StorageState 刷新失败:', error);
    process.exit(1);
});
