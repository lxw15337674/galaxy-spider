import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { browserManager } from "../../src/browser";
import { getWeiboPost } from "../../src/consumer/Weibo/weiboPostConsumer";
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

    it('should fetch media info successfully', async () => {
        // 测试运行
        const data = await getWeiboPost('5120079876328548');
        expect(data).toBeDefined();
        expect(data?.medias).toBeDefined();
        expect(Array.isArray(data?.medias)).toBe(true);
    });

    it('should verify media URL is accessible', async () => {
        const data = await getWeiboPost('5120079876328548');
        expect(data?.medias).toBeDefined();
        expect(data?.medias?.length).toBeGreaterThan(0);

        if (data?.medias && data.medias.length > 0) {
            // 验证所有媒体URL都可访问
            for (const media of data.medias) {
                const mediaUrl = media.originMediaUrl;
                
                // 发送 GET 请求并设置 stream 模式
                const response = await axios({
                    method: 'get',
                    url: mediaUrl,
                    responseType: 'stream',
                    // 取消请求超时
                    timeout: 0
                });
                
                // 立即取消请求，我们只需要验证可访问性
                response.data.destroy();
                
                // 验证响应状态码是 200
                expect(response.status).toBe(200);
            }
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