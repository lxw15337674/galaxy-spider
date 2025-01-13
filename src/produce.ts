import { processWeiboPerson } from './producers/weibo/person';
import { processWeiboTopic } from './producers/weibo/topic';
import { log } from './utils/log';
import { formatDuration } from './utils/format';


async function main() {
    const startTime = Date.now();
    try {
        log('🚀 开始执行爬虫任务...', 'info');
        
        log('📌 开始并发处理微博话题和用户...', 'info');
        
        await Promise.all([
            processWeiboTopic().then(() => {
                log(`✅ 微博话题处理完成`, 'success');
            }),
            // processWeiboPerson().then(() => {
            //     log(`✅ 微博用户处理完成`, 'success');
            // })
        ]);
        
        const processEndTime = Date.now();
        log(`🎉 所有任务执行完毕! 总耗时: ${formatDuration(processEndTime - startTime)}`, 'success');
    } catch (error) {
        log(`❌ 执行出错 (运行时长: ${formatDuration(Date.now() - startTime)}): ${error}`, 'error');
    }
}
main();
