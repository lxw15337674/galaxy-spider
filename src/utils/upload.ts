import axios from 'axios';
import sharp from 'sharp';
import { log } from './log';
import { Readable } from 'stream';
import { retryRequest } from './index';

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

const getFileExtension = (url: string): string => {
    try {
        return new URL(url).pathname.split('.').pop()?.toLowerCase() || '';
    } catch {
        return url.split('.').pop()?.split(/[?#]/)[0]?.toLowerCase() || '';
    }
};

const getFileName = (url: string): string => {
    try {
        const pathname = new URL(url).pathname;
        return pathname.split('/').pop() || `file.${getFileExtension(url)}`;
    } catch {
        return url.split('/').pop()?.split(/[?#]/)[0] || `file.${getFileExtension(url)}`;
    }
};

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

export async function uploadToGallery(
    url: string, 
    headers: Record<string, string> = {}
): Promise<MediaUploadResult> {
    try {
        const extension = getFileExtension(url);
        if (!isImage(extension) && !isVideo(extension)) {
            log(`不支持的文件类型: ${url}`, 'warn');
            return { galleryUrl: null, thumbnailUrl: null };
        }

        const isVideoFile = isVideo(extension);
        const mediaBuffer = await downloadMedia(url, headers, isVideoFile);
        if (!mediaBuffer) {
            return { galleryUrl: null, thumbnailUrl: null };
        }

        let mimeType = SUPPORTED_EXTENSIONS[extension as SupportedExtension] || 'application/octet-stream';
        let fileName = getFileName(url);
        const originalSize = mediaBuffer.length;

        if (isImage(extension)) {
            try {
                const mainBuffer = await sharp(mediaBuffer)
                    .avif({ quality: 80 })
                    .toBuffer();

                const thumbnailBuffer = await sharp(mediaBuffer)
                    .resize(600, 600, {
                        fit: 'inside',
                        withoutEnlargement: true
                    })
                    .avif({ quality: 50 })
                    .toBuffer();

                mimeType = 'image/avif';
                fileName = fileName.replace(/\.[^.]+$/, '.avif');
                
                // Upload main file
                const galleryUrl = await uploadToGalleryServer(mainBuffer, fileName, mimeType, false);
                if (!galleryUrl) {
                    return { galleryUrl: null, thumbnailUrl: null };
                }
                
                // Upload thumbnail if available
                let thumbnailUrl: string | null = null;
                if (thumbnailBuffer) {
                    thumbnailUrl = await uploadToGalleryServer(thumbnailBuffer, fileName, mimeType, true);
                }

                // Show compression statistics with URLs
                const compressedSize = mainBuffer.length;
                const thumbnailSize = thumbnailBuffer.length;
                const mainCompressionRatio = ((compressedSize / originalSize) * 100).toFixed(2);
                const thumbnailCompressionRatio = ((thumbnailSize / originalSize) * 100).toFixed(2);
                
                log(`压缩成功 [${url}] → [${galleryUrl}]->[${thumbnailUrl}] - 主图: (${formatFileSize(originalSize)} → ${formatFileSize(compressedSize)}, ${mainCompressionRatio}%), 缩略图: (${formatFileSize(originalSize)} → ${formatFileSize(thumbnailSize)}, ${thumbnailCompressionRatio}%)`, 'success');
                return { galleryUrl, thumbnailUrl };
            } catch (error) {
                log(`AVIF转换失败: ${error}`, 'error');
                return { galleryUrl: null, thumbnailUrl: null };
            }
        }

        // For video files
        log(`开始上传视频 [${url}] (${formatFileSize(originalSize)})`, 'info');
        const galleryUrl = await uploadToGalleryServer(mediaBuffer, fileName, mimeType, false);
        if (galleryUrl) {
            log(`视频上传成功 [${url}] → [${galleryUrl}] (${formatFileSize(originalSize)})`, 'success');
        }
        return { galleryUrl, thumbnailUrl: null };
    } catch (error) {
        log(`上传失败: ${url}, ${error}`, 'error');
        return { galleryUrl: null, thumbnailUrl: null };
    }
}