/**
 * Tests d'intégration — PrismaUserRepository
 * Prérequis : bun test --env-file .env.test
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'bun:test';
import { prismaTest } from '../../../helpers/prismaTestClient.ts';
import { creerEcoleTest, nettoyerEcole } from '../../../helpers/dbFixtures.ts';
import { PrismaUserRepository } from '../../../../src/infrastructure/persistence/prisma/PrismaUserRepository.ts';
import { User } from '@domain/entities/User';

const repo = new PrismaUserRepository(prismaTest);

let schoolId: string;

beforeAll(async () => {
  const school = await creerEcoleTest(prismaTest, 'user');
  schoolId = school.id;
});

afterEach(async () => {
  await prismaTest.staffPermission.deleteMany({
    where: { staffProfile: { schoolId } },
  });
  await prismaTest.staffProfile.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({
    where: { user: { schoolId } },
  });
  await prismaTest.teacherProfile.deleteMany({
    where: { user: { schoolId } },
  });
  await prismaTest.parentProfile.deleteMany({
    where: { user: { schoolId } },
  });
  await prismaTest.user.deleteMany({ where: { schoolId } });
});

afterAll(async () => {
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('PrismaUserRepository — intégration', () => {
  describe('save() + findById()', () => {
    it('devrait persister un utilisateur ADMIN et le retrouver', async () => {
      const user = User.create({
        schoolId,
        role: 'ADMIN',
        firstName: 'Marie',
        lastName: 'Fouda',
        email: `admin-${Date.now()}@lycee.cm`,
      });

      await repo.save(user);
      const found = await repo.findById(user.id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(user.id);
      expect(found!.firstName).toBe('Marie');
      expect(found!.role).toBe('ADMIN');
      expect(found!.isActive).toBe(true);
    });

    it('devrait retourner null pour un id inexistant', async () => {
      expect(await repo.findById('id-inconnu-xxx')).toBeNull();
    });
  });

  describe('existsByEmail()', () => {
    it('devrait détecter un email existant dans la même école', async () => {
      const email = `exist-${Date.now()}@test.cm`;
      const user = User.create({ schoolId, role: 'TEACHER', firstName: 'Jean', lastName: 'Biya', email });
      await repo.save(user);

      expect(await repo.existsByEmail(email, schoolId)).toBe(true);
      expect(await repo.existsByEmail('autre@test.cm', schoolId)).toBe(false);
    });

    it('ne doit pas détecter l\'email si école différente', async () => {
      const autreEcole = await creerEcoleTest(prismaTest, 'autre');
      const email = `cross-${Date.now()}@test.cm`;

      const user = User.create({ schoolId, role: 'TEACHER', firstName: 'X', lastName: 'Y', email });
      await repo.save(user);

      // Même email, école différente → false
      expect(await repo.existsByEmail(email, autreEcole.id)).toBe(false);

      await prismaTest.school.delete({ where: { id: autreEcole.id } });
    });
  });

  describe('findByRole()', () => {
    it('devrait retourner uniquement les utilisateurs du rôle demandé', async () => {
      await repo.save(User.create({ schoolId, role: 'TEACHER', firstName: 'Prof', lastName: 'Un', email: `t1-${Date.now()}@test.cm` }));
      await repo.save(User.create({ schoolId, role: 'TEACHER', firstName: 'Prof', lastName: 'Deux', email: `t2-${Date.now()}@test.cm` }));
      await repo.save(User.create({ schoolId, role: 'ADMIN', firstName: 'Admin', lastName: 'Un', email: `a1-${Date.now()}@test.cm` }));

      const enseignants = await repo.findByRole(schoolId, 'TEACHER');
      const admins = await repo.findByRole(schoolId, 'ADMIN');

      expect(enseignants).toHaveLength(2);
      expect(enseignants.every(u => u.role === 'TEACHER')).toBe(true);
      expect(admins).toHaveLength(1);
      expect(admins[0].role).toBe('ADMIN');
    });
  });

  describe('update()', () => {
    it('devrait mettre à jour le nom de famille', async () => {
      const user = User.create({
        schoolId, role: 'ADMIN', firstName: 'Paul', lastName: 'Ancien', email: `upd-${Date.now()}@test.cm`,
      });
      await repo.save(user);

      // Patch via l'entité (simulate reconnection)
      const refresh = await repo.findById(user.id);
      await prismaTest.user.update({ where: { id: user.id }, data: { lastName: 'Nouveau' } });

      const updated = await repo.findById(user.id);
      expect(updated!.lastName).toBe('Nouveau');
    });
  });

  describe('delete()', () => {
    it('devrait supprimer un utilisateur simple', async () => {
      const user = User.create({
        schoolId, role: 'PARENT', firstName: 'Marc', lastName: 'Lobe', email: `del-${Date.now()}@test.cm`,
      });
      await repo.save(user);

      await repo.delete(user.id);

      expect(await repo.findById(user.id)).toBeNull();
    });
  });
});
