/**
 * INFRASTRUCTURE LAYER — Instance Prisma Client partagée
 * Singleton — une seule connexion à la base de données.
 */
import { PrismaClient } from '@prisma/client';
import { softDeleteExtension } from './softDeleteExtension';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

export const prisma = (globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  }).$extends(softDeleteExtension)) as PrismaClient;

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}