import axios, { AxiosResponse } from 'axios';

interface VideoUrls {
  '高清 1080P'?: string;
  '高清 720P'?: string;
  '标清 480P'?: string;
  '流畅 360P'?: string;
}

interface VideoResponse {
  data: {
    Component_Play_Playinfo: {
      urls: VideoUrls;
      id: string;
      // ... other fields
    }
  }
}


interface VisitorResponse {
  retcode: number;
  msg: string;
  data: {
    sub: string;
    subp: string;
    tid: string;
    confidence: number;
    next: string;
    alt: string;
  }
}

interface VideoInfoResponse {
  ok: number;
  data: {
    data:{Component_Play_Playinfo: {
      urls:{
        string:string
      }
    }
  }
  }
}

// 获取cookie
async function getCookie(): Promise<string> {
  const data = {
    cb: 'visitor_gray_callback',
    tid: '',
    from: 'weibo'
  };

  try {
    const response = await axios.post(
      'https://passport.weibo.com/visitor/genvisitor2',
      new URLSearchParams(data).toString(),
      {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'Host': 'passport.weibo.com'
        }
      }
    );

    const jsonStr = response.data.match(/visitor_gray_callback\((.*?)\)/)?.[1];
    if (!jsonStr) {
      throw new Error('Invalid JSONP response format');
    }

    const parsedData = JSON.parse(jsonStr) as VisitorResponse;
    if (parsedData.retcode !== 20000000 || parsedData.msg !== 'succ') {
      throw new Error(`API error: ${parsedData.msg}`);
    }

    const { sub, subp } = parsedData.data;
    if (!sub || !subp) {
      throw new Error('Missing cookie data in response');
    }

    return `SUB=${sub}; SUBP=${subp}`;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Network error: ${error.message}`);
    }
    throw error;
  }
}

async function fetchWeiboVideoInfo(videoId: string): Promise<string> {
  try {
    const cookie = await getCookie();
    const data = await axios.post<VideoInfoResponse>(
      'https://weibo.com/tv/api/component',
      {
        data: JSON.stringify({
          Component_Play_Playinfo: {
            oid: videoId
          }
        })
      },
      {
        headers: {
          'referer': `https://weibo.com/tv/show/${videoId}?from=old_pc_videoshow`,
          'Cookie': cookie,
          'Host': 'weibo.com',
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );
    console.log(data);
    const urls = data.data.data.Component_Play_Playinfo.urls;
    // Try to get highest quality available, falling back to lower qualities
    const videoUrl = urls['高清 1080P' as keyof typeof urls] ||
      urls['高清 720P' as keyof typeof urls] ||
      urls['标清 480P' as keyof typeof urls] ||
      urls['流畅 360P' as keyof typeof urls];

    if (!videoUrl) {
      throw new Error('No valid video URL found');
    }

    // Add host if URL is relative
    if (videoUrl.startsWith('//')) {
      return `https:${videoUrl}`;
    }

    return videoUrl;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(`Failed to fetch video info: ${error.message}`);
    }
    throw error;
  }
}

async function main() {
  try {
    const videoId = '1034:5119205675040793';
    const result = await fetchWeiboVideoInfo(videoId);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  }
}

// 执行函数
main(); 