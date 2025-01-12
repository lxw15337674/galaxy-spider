import { getProducers } from './db/producer';
import { processWeiboPerson } from './producers/weiboperson';
import { processWeiboTopic } from './producers/weiboTopic';
import { log } from './utils/log';

async function main() {
    try {
        await processWeiboPerson(),
        log('weiboPerson 完成', 'success');
        await processWeiboTopic();
        log('weiboTopic 完成', 'success');
    } catch (error) {
        log('主函数出错:' + error, 'error');
    }
}
main();