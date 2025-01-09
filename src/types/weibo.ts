// 微博用户信息接口
export interface WeiboUser {
    id: number;                     // 用户ID
    screen_name: string;            // 用户昵称
    profile_image_url: string;      // 用户头像URL
    profile_url: string;            // 用户主页URL
    close_blue_v: boolean;          // 是否关闭蓝V认证
    description: string;            // 用户简介
    follow_me: boolean;             // 是否关注我
    following: boolean;             // 是否我在关注
    follow_count: number;           // 关注数
    followers_count: string;        // 粉丝数
    cover_image_phone: string;      // 手机封面图片
    avatar_hd: string;             // 高清头像URL
    badge: Record<string, number>;  // 用户徽章信息
    statuses_count: number;
    verified: boolean;
    verified_type: number;
    gender: string;
    mbtype: number;
    svip: number;
    urank: number;
    mbrank: number;
    followers_count_str: string;
    verified_type_ext: number;
    verified_reason: string;
    like: boolean;
    like_me: boolean;
    special_follow: boolean;
}

// 微博图片信息接口
export interface WeiboPic {
    pid: string;                    // 图片ID
    url: string;                    // 图片URL
    size: string;                   // 图片大小
    geo: {                          // 图片几何信息
        width: number;              // 宽度
        height: number;             // 高度
        croped: boolean;            // 是否裁剪
    };
    large: {                        // 大图信息
        size: string;               // 大图大小
        url: string;                // 大图URL
        geo: {                      // 大图几何信息
            width: number | string;
            height: number | string;
            croped: boolean;
        };
    };
    videoSrc?: string;             // 视频源地址（如果有）
    type?: string;                 // 媒体类型
}

// 微博页面信息接口
export interface WeiboPageInfo {
    type: string;                   // 页面类型
    object_type: number;            // 对象类型
    page_pic: {                     // 页面图片
        url: string;                // 图片URL
    };
    page_url: string;              // 页面URL
    page_title: string;            // 页面标题
    content1: string;              // 内容1
    content2: string;              // 内容2
}

// 微博内容接口
export interface WeiboMblog {
    visible: {                      // 可见性设置
        list_id: number;
    };
    created_at: string;            // 创建时间
    id: string;                    // 微博ID
    mid: string;                   // 微博MID
    can_edit: boolean;             // 是否可编辑
    text: string;                  // 微博文本内容
    textLength: number;            // 文本长度
    source: string;                // 微博来源
    favorited: boolean;
    pic_ids: string[];             // 图片ID列表
    thumbnail_pic: string;
    bmiddle_pic: string;
    original_pic: string;
    is_paid: boolean;
    mblog_vip_type: number;
    user: WeiboUser;
    reposts_count: number;
    comments_count: number;
    reprint_cmt_count: number;
    attitudes_count: number;
    mixed_count: number;
    pending_approval_count: number;
    isLongText: boolean;
    show_mlevel: number;
    topic_id: string;
    sync_mblog: boolean;
    is_imported_topic: boolean;
    darwin_tags: any[];
    ad_marked: boolean;
    mblogtype: number;
    item_category: string;
    rid: string;
    cardid: string;
    extern_safe: number;
    number_display_strategy: {
        display_text: string;
    };
    content_auth: number;
    is_show_mixed: boolean;
    comment_manage_info: {
        comment_sort_type: number;
    };
    pic_num: number;
    jump_type: number;
    mlevel: number;
    region_name: string;
    region_opt: number;
    detail_bottom_bar: number;
    analysis_extra: string;
    mblog_menu_new_style: number;
    edit_config: {
        edited: boolean;
    };
    page_info?: WeiboPageInfo;
    pics?: WeiboPic[];            // 图片详细信息
    live_photo?: string[];        // 实时照片
    bid: string;                  // 微博bid
}

// 微博卡片接口
export interface WeiboCard {
    card_type: number;             // 卡片类型
    profile_type_id: string;       // 配置类型ID
    itemid: string;               // 项目ID
    scheme: string;               // 链接scheme
    mblog: WeiboMblog;           // 微博内容
}

// 微博卡片列表信息接口
export interface WeiboCardlistInfo {
    containerid: string;           // 容器ID
    v_p: number;                  // 版本参数
    show_style: number;           // 显示样式
    total: number;                // 总数
    autoLoadMoreIndex: number;    // 自动加载更多索引
    since_id: number;             // 上次加载ID
}

// 微博API响应数据接口
export interface WeiboResponse {
    ok: number;                   // 响应状态（1为成功）
    data: {                       // 响应数据
        cardlistInfo: WeiboCardlistInfo;  // 卡片列表信息
        cards: WeiboCard[];              // 卡片数据
        scheme: string;                  // 链接scheme
        showAppTips: number;             // 是否显示应用提示
    };
}

export interface MediaContent {
    imgId: string;
    userId: number;
    weiboImgUrl: string;
    width: number;
    height: number;
    videoSrc?: string;
    weiboUrl: string;
    galleryUrl: string;
    createdAt: string;
}



// 用户徽章信息
export interface UserBadge {
    bind_taobao: number; // 是否绑定淘宝
    unread_pool: number; // 未读池
    unread_pool_ext: number; // 未读池扩展
    dzwbqlx_2016: number; // 2016年大V认证
    follow_whitelist_video: number; // 关注白名单视频
    cz_wed_2017: number; // 2017年春节活动
    panda: number; // 熊猫徽章
    user_name_certificate: number; // 用户名认证
    wenchuan_10th: number; // 汶川地震10周年
    super_star_2018: number; // 2018年超级明星
    dailv_2018: number; // 2018年大V
    qixi_2018: number; // 2018年七夕活动
    national_day_2018: number; // 2018年国庆活动
    wbzy_2018: number; // 2018年微博之夜
    memorial_2018: number; // 2018年纪念活动
    suishoupai_2019: number; // 2019年随手拍
    hongrenjie_2019: number; // 2019年红人节
    china_2019: number; // 2019年中国活动
    gongjiri_2019: number; // 2019年公益日
    hongbao_2020: number; // 2020年红包活动
    daka_2020: number; // 2020年打卡活动
    pc_new: number; // PC端新徽章
    dailv_2020: number; // 2020年大V
    weibozhiye_2020: number; // 2020年微博职业
    hongbaofeijika_2021: number; // 2021年红包飞机卡
    gaokao_2021: number; // 2021年高考活动
    party_cardid_state: number; // 党员身份证状态
    hongbaofei2022_2021: number; // 2021年红包飞机2022
    iplocationchange_2022: number; // 2022年IP位置变更
    city_university: number; // 城市大学
    pinganguo_2022: number; // 2022年苹果活动
    yayunhuiguoqi_2023: number; // 2023年亚运会国旗
    user_identity_auth: number; // 用户身份认证
    user_reality_auth: number; // 用户实名认证
    gaokao_2024: number; // 2024年高考活动
    guoqi1001_2024: number; // 2024年国庆1001活动
}

// 工具栏菜单项
export interface ToolbarMenuItem {
    type: string; // 菜单项类型（如链接、关注等）
    name: string; // 菜单项名称
    pic: string; // 菜单项图标
    params: {
        scheme?: string; // 跳转链接
        uid?: number; // 用户ID
        extparams?: {
            followcardid: string; // 关注卡片ID
        };
    };
    scheme?: string; // 跳转链接
    userInfo?: {
        id: number; // 用户ID
        idstr: string; // 用户ID字符串
        screen_name: string; // 用户昵称
        profile_image_url: string; // 用户头像URL
        following: boolean; // 是否正在关注
        verified: boolean; // 是否认证
        verified_type: number; // 认证类型
        remark: string; // 备注
        avatar_large: string; // 大头像URL
        avatar_hd: string; // 高清头像URL
        verified_type_ext: number; // 认证类型扩展
        follow_me: boolean; // 是否关注我
        mbtype: number; // 会员类型
        mbrank: number; // 会员等级
        level: number; // 用户等级
        type: number; // 用户类型
        story_read_state: number; // 故事阅读状态
        allow_msg: number; // 是否允许私信
        friendships_relation: number; // 好友关系
        close_friends_type: number; // 密友类型
        special_follow: boolean; // 是否特别关注
    };
}

// 用户信息
export interface UserInfo {
    id: number; // 用户ID
    screen_name: string; // 用户昵称
    profile_image_url: string; // 用户头像URL
    profile_url: string; // 用户主页URL
    close_blue_v: boolean; // 是否关闭蓝V
    description: string; // 用户描述
    follow_me: boolean; // 是否关注我
    following: boolean; // 是否正在关注
    follow_count: number; // 关注数
    followers_count: string; // 粉丝数
    cover_image_phone: string; // 手机封面图片URL
    avatar_hd: string; // 高清头像URL
    badge: UserBadge; // 用户徽章信息
    statuses_count: number; // 微博数
    verified: boolean; // 是否认证
    verified_type: number; // 认证类型
    gender: string; // 性别
    mbtype: number; // 会员类型
    svip: number; // 是否超级会员
    urank: number; // 用户等级
    mbrank: number; // 会员等级
    followers_count_str: string; // 粉丝数字符串
    verified_type_ext: number; // 认证类型扩展
    verified_reason: string; // 认证理由
    like: boolean; // 是否喜欢
    like_me: boolean; // 是否喜欢我
    friendships_relation: number; // 好友关系
    special_follow: boolean; // 是否特别关注
    toolbar_menus: ToolbarMenuItem[]; // 工具栏菜单项
}

// 标签信息
export interface TabInfo {
    id: number; // 标签ID
    tabKey: string; // 标签键
    must_show: number; // 是否必须显示
    hidden: number; // 是否隐藏
    title: string; // 标签标题
    tab_type: string; // 标签类型
    containerid: string; // 容器ID
    apipath?: string; // API路径
    headSubTitleText?: string; // 头部副标题文本
    new_select_menu?: number; // 新选择菜单
    gender?: string; // 性别
    params?: {
        new_select_menu: number; // 新选择菜单
        gender: string; // 性别
    };
    tab_icon?: string; // 标签图标
    tab_icon_dark?: string; // 暗色模式标签图标
    url?: string; // URL
}

// 标签列表信息
export interface TabsInfo {
    selectedTab: number; // 当前选中的标签
    tabs: TabInfo[]; // 标签列表
}

// API 响应数据
export interface WeiboUserResponse {
    ok: number; // 响应状态（1 表示成功）
    data: {
        isVideoCoverStyle: number; // 是否为视频封面样式
        isStarStyle: number; // 是否为明星样式
        userInfo: UserInfo; // 用户信息
        fans_scheme: string; // 粉丝页面链接
        follow_scheme: string; // 关注页面链接
        tabsInfo: TabsInfo; // 标签信息
        profile_ext: string; // 用户扩展信息
        scheme: string; // 页面跳转链接
        showAppTips: number; // 是否显示应用提示
    };
}