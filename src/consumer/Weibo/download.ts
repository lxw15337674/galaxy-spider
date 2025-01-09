import axios from "axios";

// 下载函数
const downloadFile = async (url: string): Promise<Uint8Array | null> => {
    try {
        const response = await axios({
            url,
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Host': new URL(url).hostname,
                'Referer': 'https://weibo.com'
            },
        });
        return new Uint8Array(response.data);
    } catch (error) {
        console.error(`❌ 文件下载失败: ${url}`, error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
};
