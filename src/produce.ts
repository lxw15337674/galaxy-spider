import 'dotenv/config';
import { processWeiboPerson } from './producers/weibo/person';
import { processWeiboTopic } from './producers/weibo/topic';
import { processXhsPerson } from './producers/xhs/person';
import { log } from './utils/log';
import { formatDuration } from './utils/format';
import { config } from './config';


async function main() {
    const startTime = Date.now();
    try {
        log(`${config.logPrefix} 🚀 开始执行爬虫任务... (模式: ${config.runMode})`, 'info');
        
        if (config.isTest) {
            log('📌 测试模式：只爬取个人主页，最多 2 页...', 'info');
            await processWeiboPerson(2).then(() => {
                log(`微博用户处理完成`, 'success');
            });
        } else {
            const xhsOnly = process.env.XHS_ONLY === 'true';
            if (xhsOnly) {
                log('📌 仅处理小红书用户...', 'info');
                await processXhsPerson().then(() => {
                    log(`小红书用户处理完成`, 'success');
                });
                const processEndTime = Date.now();
                log(`🎉 所有任务执行完毕! 总耗时: ${formatDuration(processEndTime - startTime)}`, 'success');
                return;
            }

            log('📌 开始串行处理微博用户和话题...', 'info');
            
            // 先处理微博用户
            await processWeiboPerson().then(() => {
                log(`微博用户处理完成`, 'success');
            });
            
            // 再处理微博话题
            await processWeiboTopic().then(() => {
                log(`微博话题处理完成`, 'success');
            });

            // 再处理小红书用户
            await processXhsPerson().then(() => {
                log(`小红书用户处理完成`, 'success');
            });
        }
        
        const processEndTime = Date.now();
        log(`🎉 所有任务执行完毕! 总耗时: ${formatDuration(processEndTime - startTime)}`, 'success');
    } catch (error) {
        log(`❌ 执行出错 (运行时长: ${formatDuration(Date.now() - startTime)}): ${error}`, 'error');
    }
}
main();
