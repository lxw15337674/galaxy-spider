import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { browserManager } from "../../src/browser";
import { getWeiboPost } from "../../src/consumer/weiboPost";
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

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

    it('should fetch video info successfully', async () => {
        // 测试运行
        const data = await getWeiboPost('5120079876328548');
        expect(data).toBeDefined();
        expect(data?.videos).toBeDefined();
        expect(data?.images).toBeDefined();
    });

    it('should verify video URL is accessible', async () => {
        const data = await getWeiboPost('5120079876328548');
        expect(data?.videos).toBeDefined();
        expect(data?.videos?.length).toBeGreaterThan(0);

        if (data?.videos && data.videos.length > 0) {
            const videoUrl = data.videos[0];

            // 发送 GET 请求并设置 stream 模式
            const response = await axios({
                method: 'get',
                url: videoUrl,
                responseType: 'stream',
                // 取消请求超时
                timeout: 0
            });

            // 立即取消请求，我们只需要验证可访问性
            response.data.destroy();

            // 验证响应状态码是 200
            expect(response.status).toBe(200);
        }
    });

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