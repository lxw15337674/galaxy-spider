import { getProducers } from './db/producer';
import { processWeiboPerson } from './producers/weiboperson';
import { processWeiboTopic } from './producers/weiboTopic';
import { log } from './utils/log';
import { formatDuration } from './utils/format';


async function main() {
    const startTime = Date.now();
    try {
        log('🚀 开始执行爬虫任务...', 'info');
        
        log('📌 开始处理微博话题...', 'info');
        const topicStartTime = Date.now();
        await processWeiboTopic();
        const topicEndTime = Date.now();
        log(`✅ 微博话题处理完成 (耗时: ${formatDuration(topicEndTime - topicStartTime)})`, 'success');
        
        log('📌 开始处理微博用户...', 'info');
        const personStartTime = Date.now();
        await processWeiboPerson();
        const personEndTime = Date.now();
        log(`✅ 微博用户处理完成 (耗时: ${formatDuration(personEndTime - personStartTime)})`, 'success');
        
        log(`🎉 所有任务执行完毕! 总耗时: ${formatDuration(Date.now() - startTime)}`, 'success');
    } catch (error) {
        log(`❌ 执行出错 (运行时长: ${formatDuration(Date.now() - startTime)}): ${error}`, 'error');
    }
}
main();
