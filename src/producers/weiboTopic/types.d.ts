//     ok: number;
//     data: {
//         cards?: Array<{
//             card_type: string;
//             mblog?: {
//                 id: string;
//                 created_at: string;
//                 pics?: Array<{
//                     large?: {
//                         url: string;
//                         geo: {
//                             width: number;
//                             height: number;
//                         }
//                     }
//                 }>;
//                 page_info?: {
//                     type: string;
//                     media_info?: {
//                         stream_url_hd?: string;
//                         stream_url?: string;
//                     }
//                 }
//             }
//         }>;
//         pageInfo: {
//             since_id: string;
//         }
//     }
// }




// 顶层结构
interface WeiboTopicResponse {
    ok: number;
    data: TopicData;
}

// 主数据结构
interface TopicData {
    pageInfo: PageInfo;
    cards: Card[];
    scheme: string;
    showAppTips: number;
}

// 页面信息
interface PageInfo {
    containerid: string;
    v_p: string;
    show_style: number;
    total: number;
    since_id: number;
    page_type_name: string;
    title_top: string;
    nick: string;
    page_title: string;
    page_url: string;
    desc: string;
    page_size: number;
    background_scheme: string;
    cardlist_head_cards: CardlistHeadCard[];
    containerid_bak: string;
}

// 卡片头部
interface CardlistHeadCard {
    head_type: number;
    head_type_name: string;
    show_menu: boolean;
    menu_scheme: string;
    channel_list: ChannelItem[];
}

// 频道项
interface ChannelItem {
    id: string;
    name: string;
    containerid: string;
    scheme: string;
    must_show: number;
    default_add: number;
    icon?: string;
    icon_dark?: string;
    highlight_icon?: string;
    highlight_icon_dark?: string;
}

// 卡片
interface Card {
    card_type: string;
    itemid: string;
    card_type_name: string;
    display_arrow: string;
    show_type: number;
    mblog: Mblog;
    scheme: string;
    group_style: {
        margin: number[];
    };
}

// 微博内容
interface Mblog {
    visible: {
        type: number;
        list_id: number;
    };
    created_at: string;
    id: string;
    mid: string;
    can_edit: boolean;
    text: string;
    textLength: number;
    source: string;
    favorited: boolean;
    pic_ids: string[];
    pics?: {
        type?: string;
        large?: {
            url: string;
            pid: string;
            geo: {
                width: string;
                height: string;
            }
        }
    }[];
    is_paid: boolean;
    mblog_vip_type: number;
    reposts_count: number;
    comments_count: number;
    attitudes_count: number;
    pending_approval_count: number;
    isLongText: boolean;
    bid: string;
    page_info?: PageInfo;
}

// 页面信息
interface PageInfo {
    type: string;
    object_type: number;
    url_ori: string;
    page_pic: {
        width: string;
        pid: string;
        source: string;
        url: string;
        height: string;
    };
    page_url: string;
    object_id: string;
    page_title: string;
    title: string;
    content1: string;
    content2: string;
    video_orientation: string;
    play_count: string;
    media_info: {
        stream_url: string;
        stream_url_hd: string;
        duration: number;
    };
    urls: {
        mp4_720p_mp4: string;
        mp4_hd_mp4: string;
        mp4_ld_mp4: string;
    };
}