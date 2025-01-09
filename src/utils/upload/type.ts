import { UploadStatus } from '@prisma/client';

export interface Media {
  userId: string;
  postId: string;
  originMediaUrl: string;
  createTime: Date;
  width: number;
  height: number;
  originSrc: string;
  status: UploadStatus;
}