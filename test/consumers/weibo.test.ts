import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { browserManager } from "../../src/browser";
import { getWeiboPost, runWeiboPostConsumer } from "../../src/consumer/Weibo/weiboPostConsumer";
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import { uploadToGallery } from "../../src/utils/upload";

describe('Weibo Video Tests', () => {
    const testOutputDir = path.join(__dirname, 'test-output');

    // 在测试前创建输出目录
    beforeAll(() => {
        if (!fs.existsSync(testOutputDir)) {
            fs.mkdirSync(testOutputDir, { recursive: true });
        }
    });

    it('1+1=2', () => {
        expect(1 + 1).toBe(2);
    });
    it('should run weibo post consumer', async () => {
        await runWeiboPostConsumer();
    });

    it('should fetch media info successfully', async () => {
        const page = await browserManager.createPage();
        // 测试运行
        const data = await getWeiboPost('5035378711202553', page);
        expect(data).toBeDefined();
        expect(Array.isArray(data?.medias)).toBe(true);
    });

    it('should verify media URL is accessible', async () => {
        const page = await browserManager.createPage();
        const data = await getWeiboPost('5118093107403364', page);
        expect(data?.medias).toBeDefined();
        expect(data?.medias?.length).toBeGreaterThan(0);

        if (data?.medias && data.medias.length > 0) {
            // 验证所有媒体URL都可访问
            for (const media of data.medias) {
                const result = await uploadToGallery(media.originMediaUrl, {
                    Referer: 'https://weibo.com/'
                });
                expect(result).toBeDefined();
            }
        }
    });
    

    // it('should download all media files successfully', async () => {
    //     const mediaUrl = media.originMediaUrl;
    //     const { galleryUrl, thumbnailUrl } = await uploadToGallery(mediaUrl);
    //     expect(galleryUrl).toBeDefined();
    //     expect(thumbnailUrl).toBeDefined();
    // });


    afterEach(() => {
        browserManager.closeBrowser();
    });

    // 清理测试目录
    afterAll(() => {
        if (fs.existsSync(testOutputDir)) {
            fs.rmdirSync(testOutputDir, { recursive: true });
        }
    });
}); 
// 5035378711202553