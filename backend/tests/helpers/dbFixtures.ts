import type { PrismaClient } from '@prisma/client';
import type { UserRole } from '@domain/types/enums';

let schoolCounter = 0;

export async function creerEcoleTest(prisma: PrismaClient, label = '') {
  schoolCounter++;
  return prisma.school.create({
    data: {
      name: `Lycée Test ${label || schoolCounter}`,
      subdomain: `test-${label || schoolCounter}-${Date.now()}`,
    },
  });
}

export async function creerUtilisateurTest(
  prisma: PrismaClient,
  schoolId: string,
  opts: { role?: UserRole; email?: string; suffix?: string } = {}
) {
  const suffix = opts.suffix ?? Math.random().toString(36).slice(2, 7);
  return prisma.user.create({
    data: {
      schoolId,
      role: opts.role ?? 'ADMIN',
      firstName: 'Test',
      lastName: `User-${suffix}`,
      email: opts.email ?? `test-${suffix}@zekoulabia.cm`,
      isActive: true,
      refreshTokenVersion: 0,
    },
  });
}

export async function nettoyerEcole(prisma: PrismaClient, schoolId: string) {
  await prisma.school.delete({ where: { id: schoolId } });
}
