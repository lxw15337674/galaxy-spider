import axios from 'axios';
import sharp from 'sharp';
import { log } from './log';
import { Readable } from 'stream';
import { retryRequest } from './index';
import type { MediaInfo } from '../consumer/Weibo/types';

const GALLERY_URL = 'https://gallery233.pages.dev';
const SUPPORTED_EXTENSIONS = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mov': 'video/quicktime',
    'mp4': 'video/mp4'
} as const;

type SupportedExtension = keyof typeof SUPPORTED_EXTENSIONS;

interface MediaUploadResult {
    galleryUrl: string | null;
    thumbnailUrl: string | null;
}

async function downloadMedia(url: string, headers: Record<string, string>, isVideoFile: boolean): Promise<Buffer | null> {
    try {
        const response = await axios({
            method: 'GET',
            url,
            responseType: isVideoFile ? 'stream' : 'arraybuffer',
            headers: {
                'Host': new URL(url).hostname,
                ...headers,
            },
            timeout: 60000,
            maxContentLength: 50 * 1024 * 1024,
            maxBodyLength: 50 * 1024 * 1024,
        });

        if (isVideoFile) {
            return await streamToBuffer(response.data);
        }
        return Buffer.from(response.data);
    } catch (error) {
        log(`${isVideoFile ? '视频' : '图片'}下载失败: ${url}, ${error}`, 'error');
        return null;
    }
}

export interface GalleryUploadResponse {
    /** 原始文件URL */
    src: string;
    /** 缩略图信息 */
    thumbnail?: {
        /** 缩略图URL */
        src: string;
        /** 缩略图宽度 */
        width: number;
        /** 缩略图高度 */
        height: number;
    };
}


async function uploadToGalleryServer(
    buffer: Buffer,
    mimeType: string,
    fileName: string 
): Promise<GalleryUploadResponse|null> {
    try {
        const formData = new FormData();
        formData.append('file', new Blob([buffer], { type: mimeType }), fileName);

        const response = await retryRequest(async () => {
            return await axios.post<GalleryUploadResponse[]>(`${GALLERY_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        });
        return response.data[0];
    } catch (error) {
        log(`上传失败: ${error}`, 'error');
        return null;
    }
}

export function getFileExtension(url: string): string {
    try {
        // Try to parse as URL first
        const urlObj = new URL(url);

        // Check if there's a livephoto parameter (specific to weibo URLs)
        const livephoto = urlObj.searchParams.get('livephoto');
        if (livephoto) {
            // If livephoto parameter exists, extract extension from it
            return getFileExtension(decodeURIComponent(livephoto));
        }

        // Get the last segment of the path
        const filename = urlObj.pathname.split('/').pop() || '';

        // Extract extension
        const extension = filename.split('.').pop() || '';
        return extension;
    } catch {
        // If URL parsing fails, treat as filename
        const parts = url.split('.');
        return parts.length > 1 ? parts.pop() || '' : '';
    }
}

const isImage = (ext: string): ext is SupportedExtension => 
    ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext);

const isVideo = (ext: string): ext is SupportedExtension => 
    ['mov', 'mp4'].includes(ext);

const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
};

async function streamToBuffer(stream: Readable): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
        const chunks: Buffer[] = [];
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', (error) => reject(error));
    });
}

interface ProcessedMedia {
    buffer: Buffer;
    mimeType: string;
    fileName: string;
    size: number;
}

async function processImage(buffer: Buffer, quality: number): Promise<ProcessedMedia> {
    const fileName = `${Date.now()}`;
     const webpImage = await sharp(buffer).webp({ quality }).toBuffer();
    return {
        buffer: webpImage,
        mimeType:  SUPPORTED_EXTENSIONS['webp'],
        fileName: `${fileName}.webp`,
        size: webpImage.length
    };
}


async function processThumb(url: string, headers: Record<string, string>): Promise<string|null> {
    const ext = getFileExtension(url).toLowerCase();
    if (!isImage(ext)) return null;
    const thumbBuffer = await downloadMedia(url, headers, false);
    if (!thumbBuffer) return null;
    const processed = await processImage(thumbBuffer, 100);
    const uploadRes = await uploadToGalleryServer(processed.buffer, processed.mimeType, processed.fileName);
    return uploadRes?.src || null;
}

 function logUploadStats(
    originalUrl: string, 
    originalSize: number, 
    processedSize: number, 
    galleryUrl: string | null,
    thumbnailUrl: string | null,
) {
    const sizeChangeRate = processedSize > 0
        ? ((processedSize / originalSize) * 100).toFixed(2)
        : "0";
    
    log(
        `处理成功 [${originalUrl}]\n` +
        `  尺寸变化比: ${sizeChangeRate}%\n` +
        `  原本大小: ${formatFileSize(originalSize)}, 主图大小: ${formatFileSize(processedSize)}\n` +
        `  主图: ${galleryUrl}\n` +
        `  缩略图: ${thumbnailUrl || '无'}`,
        'success'
    );
}


export async function uploadToGallery(
    media: MediaInfo, 
    headers: Record<string, string> = {}
): Promise<MediaUploadResult> {
    try {
        const extension = getFileExtension(media.originMediaUrl).toLowerCase();
        if (!isImage(extension) && !isVideo(extension)) {
            log(`不支持的文件类型: ${extension} (${media.originMediaUrl})`, 'warn');
            return { galleryUrl: null, thumbnailUrl: null };
        }

        const isVideoFile = isVideo(extension);
        const mediaBuffer = await downloadMedia(media.originMediaUrl, headers, isVideoFile);
        if (!mediaBuffer) return { galleryUrl: null, thumbnailUrl: null };

        const originalSize = mediaBuffer.length;
        const fileName = `${Date.now()}.${extension}`;

        let processedMedia: ProcessedMedia;
        try {
            processedMedia = isImage(extension)
                ? await processImage(mediaBuffer,90)
                : {
                    buffer: mediaBuffer,
                    mimeType: SUPPORTED_EXTENSIONS[extension as SupportedExtension],
                    fileName,
                    size: mediaBuffer.length
                };
        } catch (error) {
            throw new Error('处理失败');
        }

        const gallery = await uploadToGalleryServer(
            processedMedia.buffer,
            processedMedia.mimeType,
            processedMedia.fileName
        );

        if (!gallery?.src) {
            throw new Error('上传失败');
        }

        // 处理缩略图
        const thumb = media.thumbnailUrl ? await processThumb(media.thumbnailUrl, headers) : null

        logUploadStats(
            media.originMediaUrl,
            originalSize,
            processedMedia.size,
            gallery.src,
            thumb
        );

        return {
            galleryUrl: gallery.src,
            thumbnailUrl: thumb
        };
    } catch (error) {
        log(`处理失败: ${media.originMediaUrl}, ${error}`, 'error');
        return { galleryUrl: null, thumbnailUrl: null };
    }
}