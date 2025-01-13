import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import type { Producer } from "@prisma/client";
import { ProducerType } from "@prisma/client";
import { processTopicPost, processWeiboTopic } from "../../src/producers/weiboTopic";
import { processUserPost, processWeiboPerson } from "../../src/producers/weiboperson";
import { prisma } from "../../src/db";

describe('Weibo Tests', () => {
    const testTopicProducerId = "1008081e7ff1655717b13a336e677a40b75f5e";
    const testPersonProducerId = "6183984334";
    const testProducerIds = [testTopicProducerId, testPersonProducerId];
    const testIds = ["test_topic", "test_person"];

    const cleanup = async () => {
        // First delete media (which depends on posts)
        await prisma.media.deleteMany({
            where: { 
                OR: [
                    { userId: { in: testProducerIds } },
                    { post: { userId: { in: testProducerIds } } }
                ]
            }
        });
        
        // Then delete posts (which depend on producers)
        await prisma.post.deleteMany({
            where: { 
                OR: [
                    { userId: { in: testProducerIds } },
                    { producerId: { in: testIds } }
                ]
            }
        });
        
        // Finally delete producers
        await prisma.producer.deleteMany({
            where: { 
                OR: [
                    { id: { in: testIds } },
                    { producerId: { in: testProducerIds } }
                ]
            }
        });
    };

    beforeAll(cleanup);
    afterAll(cleanup);

    it('should process weibo topic successfully', async () => {
        const producer =  await prisma.producer.create({
            data: {
                name: "测试话题",
                id: "test_topic",
                producerId: testTopicProducerId,
                type: ProducerType.WEIBO_SUPER_TOPIC,
                createTime: new Date(),
                updateTime: new Date(),
                deletedAt: null
            }
        });

        const result = await processTopicPost(producer, 1);
        expect(result).toBeGreaterThan(0);
    });

    it('should process weibo person successfully', async () => {
        const producer=  await prisma.producer.create({
             data: {
                 name: "测试用户",
                 id: "test_person",
                 producerId: testPersonProducerId,
                 type: ProducerType.WEIBO_PERSONAL,
                 createTime: new Date(),
                 updateTime: new Date(),
                 deletedAt: null
             }
        });

        const result = await processUserPost(producer, 1);
        expect(result).toBeGreaterThan(0);
    });
}); 