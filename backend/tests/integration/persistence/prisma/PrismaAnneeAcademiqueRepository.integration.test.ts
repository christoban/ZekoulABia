/**
 * Tests d'intégration — PrismaAnneeAcademiqueRepository
 * Prérequis : bun test --env-file .env.test
 */
import { describe, it, expect, beforeAll, afterEach, afterAll } from 'bun:test';
import { prismaTest } from '../../../helpers/prismaTestClient.ts';
import { creerEcoleTest, nettoyerEcole } from '../../../helpers/dbFixtures.ts';
import { PrismaAnneeAcademiqueRepository } from '../../../../src/infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository.ts';

const repo = new PrismaAnneeAcademiqueRepository(prismaTest);

let schoolId: string;

const anneeBase = () => ({
  schoolId,
  name: `2025-2026-${Math.random().toString(36).slice(2, 6)}`,
  startDate: new Date('2025-09-01'),
  endDate: new Date('2026-06-30'),
  isCurrent: false,
  status: 'ACTIVE' as const,
});

beforeAll(async () => {
  const school = await creerEcoleTest(prismaTest, 'annee');
  schoolId = school.id;
});

afterEach(async () => {
  await prismaTest.academicSequence.deleteMany({ where: { schoolId } });
  await prismaTest.academicPeriod.deleteMany({
    where: { academicYear: { schoolId } },
  });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
});

afterAll(async () => {
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('PrismaAnneeAcademiqueRepository — intégration', () => {
  describe('save() + findById()', () => {
    it('devrait persister une année et la retrouver intacte', async () => {
      const id = crypto.randomUUID();
      await repo.save({ id, ...anneeBase(), isCurrent: true });

      const found = await repo.findById(id);

      expect(found).not.toBeNull();
      expect(found!.id).toBe(id);
      expect(found!.schoolId).toBe(schoolId);
      expect(found!.isCurrent).toBe(true);
      expect(found!.status).toBe('ACTIVE');
    });

    it('devrait retourner null pour un id inconnu', async () => {
      expect(await repo.findById('inconnu-xxx')).toBeNull();
    });
  });

  describe('existsByName()', () => {
    it('devrait détecter un doublon de nom', async () => {
      const props = anneeBase();
      await repo.save({ id: crypto.randomUUID(), ...props });

      expect(await repo.existsByName(schoolId, props.name)).toBe(true);
      expect(await repo.existsByName(schoolId, 'Autre-Nom')).toBe(false);
    });
  });

  describe('findCourante()', () => {
    it('devrait retourner uniquement l\'année courante', async () => {
      const idCourante = crypto.randomUUID();
      await repo.save({ id: idCourante, ...anneeBase(), name: 'Courante', isCurrent: true });
      await repo.save({ id: crypto.randomUUID(), ...anneeBase(), name: 'Ancienne', isCurrent: false });

      const courante = await repo.findCourante(schoolId);

      expect(courante).not.toBeNull();
      expect(courante!.id).toBe(idCourante);
      expect(courante!.name).toBe('Courante');
    });

    it('devrait retourner null si aucune année courante', async () => {
      await repo.save({ id: crypto.randomUUID(), ...anneeBase(), isCurrent: false });

      expect(await repo.findCourante(schoolId)).toBeNull();
    });
  });

  describe('desactiverToutesAnneesEcole()', () => {
    it('devrait mettre isCurrent=false sur toutes les années de l\'école', async () => {
      await repo.save({ id: crypto.randomUUID(), ...anneeBase(), name: 'A', isCurrent: true });
      await repo.save({ id: crypto.randomUUID(), ...anneeBase(), name: 'B', isCurrent: true });

      await repo.desactiverToutesAnneesEcole(schoolId);

      const annees = await repo.findBySchool(schoolId);
      expect(annees.every(a => !a.isCurrent)).toBe(true);
    });
  });

  describe('savePeriode() + findPeriodesByAnnee()', () => {
    it('devrait retourner les périodes triées par orderIndex', async () => {
      const anneeId = crypto.randomUUID();
      await repo.save({ id: anneeId, ...anneeBase() });

      await repo.savePeriode({
        id: crypto.randomUUID(), academicYearId: anneeId,
        name: 'Trimestre 3', type: 'TRIMESTER', orderIndex: 3,
        startDate: new Date('2026-03-01'), endDate: new Date('2026-06-30'), isCurrent: false,
      });
      await repo.savePeriode({
        id: crypto.randomUUID(), academicYearId: anneeId,
        name: 'Trimestre 1', type: 'TRIMESTER', orderIndex: 1,
        startDate: new Date('2025-09-01'), endDate: new Date('2025-12-15'), isCurrent: true,
      });
      await repo.savePeriode({
        id: crypto.randomUUID(), academicYearId: anneeId,
        name: 'Trimestre 2', type: 'TRIMESTER', orderIndex: 2,
        startDate: new Date('2026-01-05'), endDate: new Date('2026-03-01'), isCurrent: false,
      });

      const periodes = await repo.findPeriodesByAnnee(anneeId);

      expect(periodes).toHaveLength(3);
      expect(periodes[0].name).toBe('Trimestre 1');
      expect(periodes[1].name).toBe('Trimestre 2');
      expect(periodes[2].name).toBe('Trimestre 3');
    });
  });

  describe('archiver()', () => {
    it('devrait archiver une année et la désactiver', async () => {
      const id = crypto.randomUUID();
      await repo.save({ id, ...anneeBase(), isCurrent: true, status: 'ACTIVE' });

      await repo.archiver(id);

      const archived = await repo.findById(id);
      expect(archived!.status).toBe('ARCHIVED');
      expect(archived!.isCurrent).toBe(false);
    });
  });
});
