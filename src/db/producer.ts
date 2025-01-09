'use server';

import { prisma } from ".";

export const getProducers = async () => {
  return await prisma.producer.findMany({
    where: {
      deletedAt: null
    },
    orderBy: {
      createTime: 'desc'
    }
  });
};

export const getProducerById = async (id: string) => {
  return await prisma.producer.findUnique({
    where: { id }
  });
};

