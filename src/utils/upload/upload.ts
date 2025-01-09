import axios from 'axios';
import sharp from 'sharp';
import { log } from '../log';
import { Readable } from 'stream';

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

interface UploadResult {
    url: string;
    originalSize: number;
    compressedSize: number;
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
): Promise<string | null> {
    try {
        const extension = getFileExtension(url);
        let uploadBuffer: Buffer;
        
        if (!isImage(extension) && !isVideo(extension)) {
            log(`不支持的文件类型: ${url}`, 'warn');
            return null;
        }

        if(isVideo(extension)){
            try{
            log(`开始下载视频: ${url}`, 'info');
            const response = await axios({
                method: 'GET',
                url,
                responseType: 'stream',
                headers: {
                    'Host': new URL(url).hostname,
                    ...headers,
                },
                timeout: 30000,
            });
            uploadBuffer = await streamToBuffer(response.data);
        } catch (error) {
            log(`下载视频失败: ${url}, ${error}`, 'error');
            return null;
        }
        } else {
            try{
            const response = await axios({
                url,
                responseType: 'arraybuffer',
                headers: {
                    'host': new URL(url).hostname,
                    ...headers
                },
            });
            uploadBuffer = Buffer.from(response.data);
        }catch(error){
            log(`下载图片失败: ${url}, ${error}`, 'error');
            return null;
        }
        }

        const originalSize = uploadBuffer.length;
        let mimeType = SUPPORTED_EXTENSIONS[extension as SupportedExtension] || 'application/octet-stream';
        let fileName = getFileName(url);

        // webp上传会失败
        // if (isImage(extension)) {
        //     try {
        //         uploadBuffer = await sharp(uploadBuffer).webp({ quality: 90 }).toBuffer();
        //         mimeType = 'image/webp';
        //         fileName = fileName.replace(/\.[^.]+$/, '.webp');
        //     } catch (error) {
        //         log(`WebP转换失败: ${url}, ${error}`, 'error');
        //     }
        // }

        const formData = new FormData();
        formData.append('file', new Blob([uploadBuffer], { type: mimeType }), fileName);

        const uploadResponse = await axios.post(`${GALLERY_URL}/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });

        if (uploadResponse.status !== 200) {
            throw new Error(`上传失败，状态码: ${uploadResponse.status}`);
        }

        const data = uploadResponse.data;
        if (!data[0]?.src) throw new Error('上传响应缺少文件URL');
        
        const compressedSize = uploadBuffer.length;
        const compressionRatio = ((compressedSize / originalSize) * 100).toFixed(2);
        log(`上传成功: ${url} (原始: ${formatFileSize(originalSize)} → 压缩: ${formatFileSize(compressedSize)}, 压缩后: ${compressionRatio}%)`, 'success');
        
        return `${GALLERY_URL}${data[0].src}`;
    } catch (error) {
        log(`上传失败: ${url}, ${error}`, 'error');
        return null;
    }
}