import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ProducerType } from "@prisma/client";
import { prisma } from "../../src/db";
import { processTopicPost } from "../../src/producers/weibo/topic";
import { processUserPost } from "../../src/producers/weibo/person";

describe('Weibo Tests', () => {
    const testTopicProducerId = ["1008081e7ff1655717b13a336e677a40b75f5e","100808109be60c2aa9246920a02f376840e17b"]
    const testPersonProducerId = ["6183984334","5887863238","6072439004"];
    const testProducerIds = [...testTopicProducerId, ...testPersonProducerId];
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

    describe('Topic Tests', () => {
        it.each(testTopicProducerId)('should process weibo topic successfully for producer %s', async (producerId) => {
            const producer = await prisma.producer.create({
                data: {
                    name: "测试话题",
                    id: `test_topic_${producerId}`,
                    producerId: producerId,
                    type: ProducerType.WEIBO_SUPER_TOPIC,
                    createTime: new Date(),
                    updateTime: new Date(),
                    deletedAt: null
                }
            });

            const result = await processTopicPost(producer, 1);
            expect(result).toBeGreaterThan(0);
        });
    });

    describe('Person Tests', () => {
        it.each(testPersonProducerId)('should process weibo person successfully for producer %s', async (producerId) => {
            const producer = await prisma.producer.create({
                data: {
                    name: "测试用户",
                    id: `test_person_${producerId}`,
                    producerId: producerId,
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
}); 