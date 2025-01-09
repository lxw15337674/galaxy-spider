export interface Pic {
    pid: string; // 图片ID
    url: string; // 图片URL
    size: string; // 图片尺寸
    geo: {
        width: number;
        height: number;
        croped: boolean;
    };
    large: {
        size: string;
        url: string; // 高清图片URL
        geo: {
            width: string | number;
            height: string | number;
            croped: boolean;
        };
    };
    duration?: number; // 视频时长
    type?: string; // 类型（如果是视频则为 "video"）
    videoSrc?: string; // 视频URL
}

export interface Status {
    pics: Pic[]; // 图片和视频列表
}

export interface WeiboData {
    status: Status; // 微博状态
}
