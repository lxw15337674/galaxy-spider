import { expect, test, describe } from "bun:test";
import { processWeiboTopic } from "../producers/weiboTopic";
import { Producer } from "@prisma/client";

describe("WeiboTopic Producer", () => {
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

    test("should extract topic id from url", async () => {
        const id = await processWeiboTopic(producer);
        expect(id).toBe(1);
    });

});