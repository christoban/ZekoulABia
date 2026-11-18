import type { PrismaClient } from '@prisma/client';

export interface MessagerieClassSummary {
  id: string;
  name: string;
  schoolId: string;
}

/**
 * INFRASTRUCTURE — Fournit au use case InitialiserCanauxManquantsUseCase la
 * liste minimale des classes d'un établissement.
 */
export function creerMessagerieClassLister(
  prisma: PrismaClient,
): (schoolId: string) => Promise<MessagerieClassSummary[]> {
  return async (schoolId: string) =>
    prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true, schoolId: true },
    });
}

