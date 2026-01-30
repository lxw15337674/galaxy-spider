import { Platform, UploadStatus, type Post } from '@prisma/client';
import { prisma } from '.';

export const createPost = async (data: {
    platform: Platform;
    userId: string;
    platformId: string | number;
    producerId: string;
    createTime: Date;
}): Promise<Post> => {
    const platformId = String(data.platformId);
    const postData = {
        userId: data.userId,
        platform: data.platform,
        platformId,
        producerId: data.producerId,
        status: UploadStatus.PENDING,
        createTime: data.createTime
    };
    return await prisma.post.upsert({
        where: {
            platform_platformId: {
                platform: data.platform,
                platformId
            }
        },
        update: {
            userId: data.userId,
            producerId: data.producerId,
            createTime: data.createTime
        },
        create: postData
    });
};

export const updatePostStatus = async (id: string, status: UploadStatus) => {
    return await prisma.post.update({
        where: { id },
        data: { status }
    });
};
// 获取pending的post
export const getPendingPost = async () => {
    return await prisma.post.findFirst({
        where: { status: UploadStatus.PENDING }
    });
};
export const countPendingPost = async () => {
    return await prisma.post.count({
        where: { status: UploadStatus.PENDING }
    });
};

