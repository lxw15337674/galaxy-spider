'use server';

import { prisma } from ".";
import { ProducerType } from "@prisma/client";

export const getProducers = async (type: ProducerType) => {
  return await prisma.producer.findMany({
    where: {
      deletedAt: null,
      type: type,
      producerId: {
        not: null
      }
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

export const updateProducerLastPostTime = async (id: string) => {
  return await prisma.producer.update({
    where: { id },
    data: {
      lastPostTime: new Date()
    }
  });
};

