import axios from 'axios';
import sharp from 'sharp';
import path from 'path';

// 配置常量
const Gallery_URL = 'https://telegraph-image-bww.pages.dev';
const SUPPORTED_TYPES = {
    images: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    videos: ['mov', 'mp4']
} as const;

// 工具函数
const getFileExtension = (url: string): string => {
    try {
        const urlPath = new URL(url).pathname;
        return path.extname(urlPath).toLowerCase().slice(1) || '';
    } catch {
        const match = url.match(/\.([a-zA-Z0-9]+)(?:[?#]|$)/);
        return match ? match[1].toLowerCase() : '';
    }
};

const getMimeType = (extension: string): string => {
    const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'mov': 'video/quicktime',
        'mp4': 'video/mp4'
    };
    return mimeTypes[extension] || 'application/octet-stream';
};
const isImageFile = (extension: string): boolean => 
    SUPPORTED_TYPES.images.includes(extension as typeof SUPPORTED_TYPES.images[number]);

const isVideoFile = (extension: string): boolean => 
    SUPPORTED_TYPES.videos.includes(extension as typeof SUPPORTED_TYPES.videos[number]);

// 类型定义
interface TransferResult {
    url: string;
    originalSize: number;
    compressedSize: number;
}

// 下载函数
const downloadFile = async (url: string): Promise<Uint8Array|null> => {
    try {
        const response = await axios({
            url,
            responseType: 'arraybuffer',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Host': new URL(url).hostname
            },
            timeout: 30000 // 30秒超时
        });
        return new Uint8Array(response.data);
    } catch (error) {
        console.error(`❌ 文件下载失败: ${url}`, error instanceof Error ? error.message : 'Unknown error');
        return null;
    }
};

// 上传媒体文件
export async function transferMedia(url: string): Promise<TransferResult | null> {
    try {
        const fileBuffer = await downloadFile(url);
        if (!fileBuffer) {
            throw new Error('Download failed');
        }

        const extension = getFileExtension(url);
        const originalSize = fileBuffer.length;
        
        let uploadBuffer: Buffer | Uint8Array = fileBuffer;
        let mimeType = getMimeType(extension);
        let fileName = `file.${extension || 'bin'}`;

        // 图片转换为webp
        if (isImageFile(extension)) {
            try {
                uploadBuffer = await sharp(fileBuffer)
                    .webp({ quality: 90 })
                    .toBuffer();
                mimeType = 'image/webp';
                fileName = 'file.webp';
            } catch (error) {
                console.error(`WebP conversion failed for ${url}:`, error);
                // 如果转换失败，使用原始buffer
            }
        }

        const compressedSize = uploadBuffer.length;
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
            throw new Error('Upload response missing file URL');
        }
        return {
            url: `${Gallery_URL}${data[0].src}`,
            originalSize,
            compressedSize
        };
    } catch (error) {
        console.error(`Transfer failed for ${url}:`, error);
        return null;
    }
}

// 批量上传函数
export const uploadToGallery = async (urls: string[]): Promise<string[]> => {
    const results: string[] = [];
    
    for (const url of urls) {
        const extension = getFileExtension(url);
        if (!isImageFile(extension) && !isVideoFile(extension)) {
            console.warn(`Skipping unsupported file type: ${url}`);
            continue;
        }

        const result = await transferMedia(url);
        if (result) {
            results.push(result.url);
        }
    }
    
    return results;
};