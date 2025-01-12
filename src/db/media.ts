import { PrismaClient, UploadStatus, type Media } from '@prisma/client';
import { log } from '../utils/log';
import { prisma } from '.';


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

type MediaData = Omit<Media, 'id'|'status'|'createTime'|'updateTime'|'deletedAt'>
export const saveMedias = async (data: MediaData[]):Promise<number> => {
    try {
        if (!data?.length) {
            log('没有需要保存的数据', 'warn');
            return 0
        }

        const mediaUrls = data.map(img => img.originMediaUrl).filter((url): url is string => !!url);
        const existingUrls = await prisma.media.findMany({
            where: {
                originMediaUrl: {
                    in: mediaUrls
                }
            },
            select: { originMediaUrl: true }
        });

        const existingSet = new Set(existingUrls.map(img => img.originMediaUrl));
        const newImages = data.filter(img => img.originMediaUrl && !existingSet.has(img.originMediaUrl));

        if (!newImages.length) {
            return 0
        }

        const result = await prisma.media.createMany({
            data: newImages.map(img => ({
                ...img,
                width: Number(img?.width),
                height: Number(img?.height),
                status: UploadStatus.UPLOADED
            }))
        });
        log(`保存成功 ${result.count} 张图片记录,跳过 ${existingUrls.length} 张`, 'success');
        return result.count
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