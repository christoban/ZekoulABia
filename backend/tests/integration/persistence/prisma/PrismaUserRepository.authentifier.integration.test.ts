/**
 * Test d'intégration — PrismaUserRepository.authentifier, touché par le retrait du cast
 * `role as any`. Le login est un chemin public sensible : avant ce correctif, un rôle hors
 * énumération (`role=HACKED` par exemple) faisait lever une PrismaClientValidationError (500,
 * potentiellement avec détail d'erreur en dev) au lieu d'un échec d'authentification normal.
 * Vérifie sur la vraie base qu'un rôle invalide échoue proprement (null, comme des identifiants
 * invalides) et qu'un rôle valide continue de fonctionner normalement.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import bcrypt from 'bcryptjs';
import { PrismaUserRepository } from '../../../../src/infrastructure/persistence/prisma/PrismaUserRepository.ts';
import { prismaTest } from '../../../helpers/prismaTestClient.ts';
import { creerEcoleTest, nettoyerEcole } from '../../../helpers/dbFixtures.ts';

let schoolId: string;
const PLAIN_PASSWORD = 'Sup3rSecret!';

beforeAll(async () => {
  const school = await creerEcoleTest(prismaTest, 'authentifierRole');
  schoolId = school.id;
  const passwordHash = await bcrypt.hash(PLAIN_PASSWORD, 10);
  await prismaTest.user.create({
    data: {
      schoolId, role: 'ADMIN', firstName: 'Test', lastName: 'Admin',
      email: 'admin-authentifier@zekoulabia.cm', isActive: true, passwordHash, refreshTokenVersion: 0,
    },
  });
});

afterAll(async () => {
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('PrismaUserRepository.authentifier — rôle invalide traité comme un échec, pas une erreur 500', () => {
  it("renvoie null (pas d'exception) pour un rôle hors énumération, exactement comme des identifiants invalides", async () => {
    const repo = new PrismaUserRepository(prismaTest);
    const result = await repo.authentifier('admin-authentifier@zekoulabia.cm', schoolId, PLAIN_PASSWORD, 'HACKED');
    expect(result).toBeNull();
  });

  it('authentifie normalement avec un rôle valide et le bon mot de passe', async () => {
    const repo = new PrismaUserRepository(prismaTest);
    const result = await repo.authentifier('admin-authentifier@zekoulabia.cm', schoolId, PLAIN_PASSWORD, 'ADMIN');
    expect(result).not.toBeNull();
    expect(result?.role).toBe('ADMIN');
  });

  it('renvoie null si le rôle valide ne correspond pas au compte réel', async () => {
    const repo = new PrismaUserRepository(prismaTest);
    const result = await repo.authentifier('admin-authentifier@zekoulabia.cm', schoolId, PLAIN_PASSWORD, 'TEACHER');
    expect(result).toBeNull();
  });
});
