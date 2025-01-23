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
    'avif': 'image/avif',
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

async function uploadToGalleryServer(
    buffer: Buffer,
    fileName: string,
    mimeType: string,
    isThumb = false
): Promise<string | null> {
    try {
        const formData = new FormData();
        const finalFileName = isThumb ? fileName.replace(/\.[^.]+$/, '_thumb.avif') : fileName;
        formData.append('file', new Blob([buffer], { type: mimeType }), finalFileName);

        const response = await retryRequest(async () => {
            return await axios.post(`${GALLERY_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
        });

        if (!response.data[0]?.src) {
            throw new Error('上传响应缺少文件URL');
        }

        const url = `${GALLERY_URL}${response.data[0].src}`;
        return url;
    } catch (error) {
        log(`${isThumb ? '缩略图' : '文件'}上传失败: ${error}`, 'error');
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

async function processImage(buffer: Buffer, fileName: string): Promise<ProcessedMedia> {
    const processed = await sharp(buffer)
        .avif({ quality: 80 })
        .toBuffer();
    
    return {
        buffer: processed,
        mimeType: 'image/avif',
        fileName: `${fileName}.avif`,
        size: processed.length
    };
}

async function processThumbnail(url: string, fileName: string, headers: Record<string, string>): Promise<string | null> {
    const thumbnailBuffer = await downloadMedia(url, headers, false);
    if (!thumbnailBuffer) return null;

    const processed = await sharp(thumbnailBuffer)
        .avif({ quality: 80 })
        .toBuffer();
    
    const thumbFileName = `${fileName}_thumb.avif`;
    return await uploadToGalleryServer(processed, thumbFileName, 'image/avif', true);
}

async function logUploadStats(
    originalUrl: string, 
    originalSize: number, 
    processedSize: number, 
    galleryUrl: string | null,
    thumbnailUrl: string | null,
    thumbnailSize?: number
) {
    const mainCompressionRatio = ((processedSize / originalSize) * 100).toFixed(2);
    const thumbnailCompressionRatio = thumbnailSize ? ((thumbnailSize / originalSize) * 100).toFixed(2) : "0";
    
    log(
        `处理成功 [${originalUrl}]\n` +
        `  主图: ${galleryUrl} (${formatFileSize(originalSize)} → ${formatFileSize(processedSize)}, ${mainCompressionRatio}%)\n` +
        `  缩略图: ${thumbnailUrl || '无'} ${thumbnailSize ? `(${formatFileSize(thumbnailSize)}, ${thumbnailCompressionRatio}%)` : ''}`,
        'success'
    );
}

export async function uploadToGallery(
    media: MediaInfo, 
    headers: Record<string, string> = {}
): Promise<MediaUploadResult> {
    try {
        const extension = getFileExtension(media.originMediaUrl);
        if (!isImage(extension) && !isVideo(extension)) {
            log(`不支持的文件类型: ${media.originMediaUrl}`, 'warn');
            return { galleryUrl: null, thumbnailUrl: null };
        }

        const isVideoFile = isVideo(extension);
        const mediaBuffer = await downloadMedia(media.originMediaUrl, headers, isVideoFile);
        if (!mediaBuffer) {
            log(`下载媒体文件失败: ${media.originMediaUrl}`, 'error');
            return { galleryUrl: null, thumbnailUrl: null };
        }

        const originalSize = mediaBuffer.length;
        const fileName = Date.now() + '.' + extension;

        let processedMedia: ProcessedMedia;
        if (isImage(extension)) {
            try {
                processedMedia = await processImage(mediaBuffer, fileName);
            } catch (error) {
                log(`处理图片失败: ${media.originMediaUrl}, ${error}`, 'error');
                return { galleryUrl: null, thumbnailUrl: null };
            }
        } else {
            processedMedia = {
                buffer: mediaBuffer,
                mimeType: SUPPORTED_EXTENSIONS[extension as SupportedExtension],
                fileName,
                size: mediaBuffer.length
            };
            log(`开始上传视频 [${media.originMediaUrl}] (${formatFileSize(originalSize)})`, 'info');
        }

        const galleryUrl = await uploadToGalleryServer(
            processedMedia.buffer,
            processedMedia.fileName,
            processedMedia.mimeType,
            false
        );

        if (!galleryUrl) {
            log(`上传${isVideoFile ? '视频' : '主图'}失败: ${media.originMediaUrl}`, 'error');
            return { galleryUrl: null, thumbnailUrl: null };
        }

        const thumbnailUrl = media.thumbnailUrl 
            ? await processThumbnail(media.thumbnailUrl, fileName, headers)
            : null;

        if (media.thumbnailUrl && !thumbnailUrl) {
            log(`上传缩略图失败: ${media.thumbnailUrl}`, 'warn');
        }

        await logUploadStats(
            media.originMediaUrl,
            originalSize,
            processedMedia.size,
            galleryUrl,
            thumbnailUrl
        );

        return { galleryUrl, thumbnailUrl };
    } catch (error) {
        log(`处理失败: ${media.originMediaUrl}, ${error}`, 'error');
        return { galleryUrl: null, thumbnailUrl: null };
    }
}