import { getProducers } from './db/producer';
import {  processWeiboPerson } from './producers/weiboperson';
import { processWeiboTopic } from './producers/weiboTopic';
import { log } from './utils/log';

async function main() {
    try {
        const producers = await getProducers();
        await processWeiboPerson(producers),
         await  processWeiboTopic(producers)
    } catch (error) {
        log('主函数出错:' + error, 'error');
    }
}
main();