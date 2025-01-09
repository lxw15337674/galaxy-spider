import axios from "axios";

const post = '4902736083029911'

const URL = 'https://weibo.com/7533131147/4902736083029911'

export const downloadImage = async (url: string): Promise<Uint8Array | null> => {
    try {
        const response = await axios({
            url: URL,
            // params: {
            //     id: post,
            //     locale: 'zh-CN',
            //     isGetLongText: true
            // },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://weibo.com/7533131147/4902736083029911',
            }
        });
        return response.data
    } catch (error) {
        console.error(`❌ 图片下载失败: ${url}`);
        return null
    }
};

downloadImage(URL)