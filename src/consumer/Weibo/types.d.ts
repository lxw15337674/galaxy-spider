export interface WeiboUser {
    id: number;
    screen_name: string;
    profile_image_url: string;
    profile_url: string;
    description: string;
    follow_me: boolean;
    following: boolean;
    follow_count: number;
    followers_count: string;
    cover_image_phone: string;
    avatar_hd: string;
    verified: boolean;
    verified_type: number;
    verified_type_ext: number;
    verified_reason: string;
    close_blue_v: boolean;
    gender: string;
    mbtype: number;
    svip: number;
    urank: number;
    mbrank: number;
    followers_count_str: string;
    statuses_count: number;
}


export interface PagePic {
    width: string;
    pid: string;
    source: string;
    is_self_cover: string;
    type: string;
    url: string;
    height: string;
}

export interface PageInfo {
    type: string;
    object_type: number;
    url_ori: string;
    page_pic: PagePic;
    page_url: string;
    object_id: string;
    page_title: string;
    title: string;
    content1: string;
    content2: string;
    video_orientation: string;
    play_count: string;
    media_info: {
        stream_url_hd: string;
        stream_url: string;
    };
    urls?: {
        mp4_hd_mp4?: string;
        mp4_ld_mp4?: string;
    };
}

export interface Geo {
    width: number;
    height: number;
    croped: boolean;
}

export interface Large {
    size: string;
    url: string;
    geo: {
        width: string | number;
        height: string | number;
        croped: boolean;
    };
}

export interface Pic {
    pid: string;
    url: string;
    size: string;
    geo: Geo;
    large: Large;
    duration?: number;
    type?: string;
    videoSrc?: string;
}

export interface Status {
    visible: {
        type: number;
        list_id: number;
    };
    created_at: string;
    id: string;
    mid: string;
    text: string;
    textLength: number;
    source: string;
    favorited: boolean;
    pic_ids?: string[];
    thumbnail_pic?: string;
    bmiddle_pic?: string;
    original_pic?: string;
    is_paid: boolean;
    mblog_vip_type: number;
    user: WeiboUser;
    reposts_count: number;
    comments_count: number;
    attitudes_count: number;
    pending_approval_count: number;
    isLongText: boolean;
    show_mlevel: number;
    darwin_tags: any[];
    mblogtype: number;
    rid: string;
    content_auth: number;
    status_title: string;
    ok: number;
    pics?: Pic[];
    page_info?: PageInfo;
    bid: string;
}

export interface WeiboData {
    hotScheme?: string;
    appScheme?: string;
    callUinversalLink?: boolean;
    callWeibo?: boolean;
    schemeOrigin?: boolean;
    appLink?: string;
    xianzhi_scheme?: string;
    third_scheme?: string;
    status: Status;
    call?: number;
}



export interface MediaInfo {
    width: number | null;
    height: number | null;
    originMediaUrl: string;
    originSrc: string;
    thumbnailUrl: string | null;
    type: 'image' | 'video';
}
