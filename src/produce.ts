import { getProducers } from './common/db/producer';
import { processWeibo } from './producers/weiboperson1';
import { log } from './utils/log';

async function main() {
    try {
        // 从数据库获取所有活跃的生产者
        const producers = await getProducers();
        // 爬取所有生产者的微博数据
        await processWeibo(producers);
    } catch (error) {
        log('主函数出错:' + error, 'error');
    }
}
main();