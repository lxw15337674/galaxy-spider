import axios from 'axios';
import { sleep } from '..';
import sharp from 'sharp';

// 根据URL获取文件扩展名
const getFileExtension = (url: string): string => {
    const match = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
    return match ? match[1].toLowerCase() : '';
};

// 根据扩展名获取MIME类型
const getMimeType = (extension: string): string => {
    const mimeTypes: { [key: string]: string } = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'mov': 'video/quicktime',
        'mp4': 'video/mp4'
    };
    return mimeTypes[extension] || 'image/jpeg';
};
// 下载图片并返回数据
export const downloadImage = async (url: string): Promise<Uint8Array|null> => {
    try {
        const response = await axios({
            url,
           responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Host': 'weibo.com'
            }
        });
        return new Uint8Array(response.data);
    } catch (error) {
        console.error(`❌ 图片下载失败: ${url}`);
        return null
    }
};

// 带重试机制的请求
const retryRequest = async <T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> => {
    let lastError: Error | null = null; // 初始化 lastError 为 null
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn(); // 尝试执行函数
        } catch (error) {
            lastError = error as Error; // 捕获错误
            if (i < maxRetries - 1) {
                await sleep(1000 * Math.pow(2, i)); // 指数退避重试
                continue;
            }
        }
    }
    throw lastError; // 重试次数用尽后抛出错误
};


const Gallery_URL = 'https://telegraph-image-bww.pages.dev';

// 判断是否为图片类型
const isImageFile = (extension: string): boolean => {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    return imageExtensions.includes(extension.toLowerCase());
};

interface TransferResult {
    url: string;
    originalSize: number;
    compressedSize: number;
}

export async function transferImage(url: string): Promise<TransferResult | null> {
    return retryRequest(async () => {
        // 下载图片
        const imageBuffer = await downloadImage(url);
        const extension = getFileExtension(url);
        if (!imageBuffer) {
            throw new Error('Download image failed');
        }
        const originalSize = imageBuffer.length;
        
        
        let uploadBuffer: Buffer | Uint8Array = imageBuffer;
        let mimeType = getMimeType(extension);
        let fileName = `file.${extension || 'jpg'}`;

        // 只对图片类型进行webp转换和压缩
        if (isImageFile(extension)) {
            const image = sharp(imageBuffer);
            uploadBuffer = await image
                .webp({
                    quality: 90,
                })
                .toBuffer();
            mimeType = 'image/webp';
            fileName = 'file.webp';
        }

        const compressedSize = uploadBuffer.length;

        // 上传到图床
        const formData = new FormData();
        const blob = new Blob([uploadBuffer], { type: mimeType });
        formData.append('file', blob, fileName);

        const response = await fetch(`${Gallery_URL}/upload`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) {
            throw new Error(`Upload failed with status: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data[0]?.src) {
            throw new Error('Upload response missing image URL');
        }

        const galleryUrl = `${Gallery_URL}${data[0].src}`;
        
        return {
            url: galleryUrl,
            originalSize,
            compressedSize
        };
    }, 3).catch(error => {
        console.error(`Transfer image failed:`, error);
        return null;
    });
}

