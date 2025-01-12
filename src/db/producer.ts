'use server';

import { prisma } from ".";
import { ProducerType } from "@prisma/client";

export const getProducers = async (type: ProducerType) => {
  return await prisma.producer.findMany({
    where: {
      deletedAt: null,
      type: type
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

