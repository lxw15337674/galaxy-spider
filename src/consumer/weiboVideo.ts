import axios, { AxiosResponse } from 'axios';
import { getWeiboCookie } from '../common/Cookie/weibo';



async function fetchWeiboVideoInfo(videoId: string): Promise<string> {
    try {
        const cookie = await getWeiboCookie();
        const data = await axios.get(
            'https://m.weibo.cn/statuses/show?id=P8ChJ1MRZ',
            {
                headers: {
                    // 'referer': `https://weibo.com/tv/show/${videoId}?from=old_pc_videoshow`,
                    'Cookie': cookie,
                    'Host': 'weibo.com',
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            }
        );
        console.log(data);

        return data;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Failed to fetch video info: ${error.message}`);
        }
        throw error;
    }
}

async function main() {
    try {
        const videoId = '1034:5119205675040793';
        const result = await fetchWeiboVideoInfo(videoId);
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
        process.exit(1);
    }
}

// 执行函数
main(); 