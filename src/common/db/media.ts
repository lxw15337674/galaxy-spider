import { PrismaClient, UploadStatus } from '@prisma/client';
import { Media } from '../upload/type';
import { log } from '../../utils/log';

const prisma = new PrismaClient();

export const updateMediaGalleryUrl = async (id:number,galleryMediaUrl:string,status:UploadStatus) => {
    try {
        await prisma.media.update({
            where: {
                id
            },
            data: {
                galleryMediaUrl,
                status
            }
        });
        return true
    }
    catch (error) {
        log(`保存失败: ${error}`, 'error');
        return false
    }
}

export const saveMedias = async (data: Media[]):Promise<number> => {
    try {
        if (!data?.length) {
            log('没有需要保存的数据', 'warn');
            return 0
        }

        const existingUrls = await prisma.media.findMany({
            where: {
                originSrc: {
                    in: data.map((img: Media) => img.originSrc)
                }
            },
            select: { originSrc: true }
        });

        const existingSet = new Set(existingUrls.map((img) => img.originSrc));
        const newImages = data.filter((img: Media) => !existingSet.has(img.originSrc));

        if (!newImages.length) {
            // log('所有图片都已存在', 'info');
            return 0
        }

        const result = await prisma.media.createMany({
            data: newImages.map((img: Media) => ({
                ...img,
                createTime: img.createTime || new Date(),
            }))
        });
        log(`保存成功 ${result.count} 张图片记录,跳过 ${existingUrls.length} 张`, 'success');
        return  result.count
    } catch (error) {
        log(`保存失败: ${error}`, 'error');
        return 0
    }
}

export async function getRemainingUploadCount(): Promise<number> {
    const result = await prisma.media.count({
        where: {
            galleryMediaUrl: null,
            originMediaUrl: {
                not: null
            }
        },
        orderBy: {
            createTime: 'desc'
        }
    });
    return result;
}

export async function getUploadMedias(limit: number = 100) {
    return await prisma.media.findMany({
        where: {
            galleryMediaUrl: null,
            status: UploadStatus.PENDING
        },
        take: limit,
        orderBy: {
            createTime: 'desc'
        }
    });
}