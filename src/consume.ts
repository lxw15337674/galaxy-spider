import { weiboPostConsumer } from './consumer/Weibo/weiboPostConsumer';
import { log } from './utils/log';
import uploadImageToGallery from './utils/upload';

async function main() {
    try {
        await weiboPostConsumer();
    } catch (error) {
        log('主函数出错:' + error, 'error');
    }
}
main();