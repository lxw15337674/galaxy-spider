import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { Producer } from "@prisma/client";
import { processWeiboTopic } from "../../src/producers/weiboTopic";
import { processWeiboPerson } from "../../src/producers/weiboperson";

describe('Weibo  Tests', () => {
    it('should process weibo topic successfully', async () => {
        const producer: Producer[] = [{
            name: "测试话题",
            id: "123456",
            weiboTopicIds: ["100808fa2e191f05c4e748d06033886dad8048"],
            weiboIds: [],
            xiaohongshuIds: [],
            douyinIds: [],
            weiboChaohua: null,
            createTime: new Date(),
            updateTime: new Date(),
            deletedAt: null
        }]

        const result = await processWeiboTopic(producer,1);
        expect(result).toBeGreaterThan(0);
    });
    it('should process weibo person successfully', async () => {
        const producer: Producer[] = [{
            name: "测试用户",
            id: "123456",
            weiboTopicIds: [],
            weiboIds: ["6183984334"],
            xiaohongshuIds: [],
            douyinIds: [],
            weiboChaohua: null,
            createTime: new Date(),
            updateTime: new Date(),
            deletedAt: null
        }]
        const result = await processWeiboPerson(producer,1);
        expect(result).toBeGreaterThan(0);
    });
}); 