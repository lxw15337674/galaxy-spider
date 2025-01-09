import { Platform, UploadStatus, type Post } from '@prisma/client';
import { prisma } from '.';

export const createPost = async (data: {
    platform: Platform;
    userId: string;
    platformId: string;
}): Promise<Post> => {
    const postData = {
        userId: data.userId,
        platform: data.platform,
        platformId: data.platformId,
        producerId: data.userId,
        status: UploadStatus.PENDING
    };
    console.log('postData', data.platform, data.platformId, data.userId);
    return await prisma.post.upsert({
        where: {
            platform_platformId: {
                platform: data.platform,
                platformId: data.platformId
            }
        },
        update: {
            userId: data.userId,
            producerId: data.userId
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

