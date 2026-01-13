/**
 * Cookie 刷新脚本
 * 用于 GitHub Actions 自动刷新和验证 Cookie
 */

import { refreshAndValidateCookies } from '../utils/cookie.js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

async function main() {
    try {
        console.log('==========================================');
        console.log('🔄 Cookie 自动刷新任务');
        console.log('==========================================\n');
        
        const success = await refreshAndValidateCookies();
        
        if (success) {
            console.log('\n✅ Cookie 刷新成功，可以继续执行爬虫任务');
            process.exit(0);
        } else {
            console.log('\n❌ Cookie 已失效，需要手动重新登录');
            console.log('💡 请在本地运行有头浏览器登录微博，然后更新 Gist');
            process.exit(1);
        }
    } catch (error) {
        console.error('\n❌ Cookie 刷新过程出错:', error);
        process.exit(1);
    }
}

main();
