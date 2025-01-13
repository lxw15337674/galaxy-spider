// import axios from "axios";
// import type { AxiosRequestConfig } from "axios";
// import * as fs from 'fs';
// import path from "path";
// import { log } from "./log";



// const DEFAULT_HEADERS = {
//     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
//     'Referer': 'https://weibo.com/',
//     'Accept': '*/*',
//     'Accept-Encoding': 'gzip, deflate, br',
//     'Connection': 'keep-alive'
// };

// export const downloadMedia = async (url: string): Promise<string> => {
//      const  outputDir = path.join(process.cwd(), 'downloads')
//      const  fileName = path.basename(url.split('?')[0])
//      const  headers = {}

//     // 确保输出目录存在
//     if (!fs.existsSync(outputDir)) {
//         fs.mkdirSync(outputDir, { recursive: true });
//     }

//     try {
//         const response = await axios({
//             method: 'GET',
//             url,
//             responseType: 'stream',
//             headers: {
//                 ...DEFAULT_HEADERS,
//                 ...headers,
//                 'Host': new URL(url).hostname
//             },
//             timeout: 1000 * 60 * 5,
//         });

//         const filePath = path.join(outputDir, fileName);
//         const writer = fs.createWriteStream(filePath);
//         response.data.pipe(writer);

//         await new Promise((resolve, reject) => {
//             writer.on('finish', resolve);
//             writer.on('error', reject);
//         });

//         const stats = fs.statSync(filePath);
//         log(`Successfully downloaded: ${fileName}, size: ${stats.size} bytes`, 'success');

//         return filePath;
//     } catch (error) {
//         log(`Failed to download ${url}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
//         throw error;
//     }
// };
