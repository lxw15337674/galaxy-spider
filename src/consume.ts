import { runWeiboPostConsumer } from './consumer/Weibo/weiboPostConsumer';
import { log } from './utils/log';

async function main() {
    try {
        await runWeiboPostConsumer();
    } catch (error) {
        log('主函数出错:' + error, 'error');
    }
}
main();