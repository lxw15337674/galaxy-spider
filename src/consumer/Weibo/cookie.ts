// import axios from "axios";

// // 获取cookie
// export async function getWeiboCookie(): Promise<string> {
//     const data = {
//         cb: 'visitor_gray_callback',
//         tid: '',
//         from: 'weibo'
//     };

//     try {
//         const response = await axios.post(
//             'https://passport.weibo.com/visitor/genvisitor2',
//             new URLSearchParams(data).toString(),
//             {
//                 headers: {
//                     'content-type': 'application/x-www-form-urlencoded',
//                     'Host': 'passport.weibo.com'
//                 }
//             }
//         );

//         const jsonStr = response.data.match(/visitor_gray_callback\((.*?)\)/)?.[1];
//         if (!jsonStr) {
//             throw new Error('Invalid JSONP response format');
//         }

//         const parsedData = JSON.parse(jsonStr) 
//         if (parsedData.retcode !== 20000000 || parsedData.msg !== 'succ') {
//             throw new Error(`API error: ${parsedData.msg}`);
//         }

//         const { sub, subp } = parsedData.data;
//         if (!sub || !subp) {
//             throw new Error('Missing cookie data in response');
//         }

//         return `SUB=${sub}; SUBP=${subp}`;
//     } catch (error) {
//         if (axios.isAxiosError(error)) {
//             throw new Error(`Network error: ${error.message}`);
//         }
//         throw error;
//     }
// }
