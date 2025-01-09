import axios from "axios";
import * as fs from 'fs';
import path from "path";

const downloadVideo = async (url: string, postId: string): Promise<void> => {
    const videosDir = path.join(process.cwd(), 'videos');
    if (!fs.existsSync(videosDir)) {
        fs.mkdirSync(videosDir, { recursive: true });
    }

    const response = await axios({
        method: 'GET',
        url,
        responseType: 'stream'
    });

    const extension = url.includes('mp4') ? 'mp4' : 'mp4';
    const filePath = path.join(videosDir, `${postId}.${extension}`);
    const writer = fs.createWriteStream(filePath);

    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
    });
};
