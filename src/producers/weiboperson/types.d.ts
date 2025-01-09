// Types
export interface PicItem {
    videoSrc?: string;
    large: {
        url: string;
        geo: {
            width: string | number;
            height: string | number;
        };
    };
}

export interface PageResult {
    cards: WeiboMblog[];
    sinceId: string;
}
