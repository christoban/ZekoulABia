/**
 * Test d'intégration — atomicité de l'écriture des affectations générées.
 *
 * Si une écriture échoue au milieu d'un batch (ici violation de la contrainte d'unicité
 * classId/subjectId), aucune des écritures précédentes du même batch ne doit persister.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { PrismaTeachingAssignmentGeneratorRepository } from '../../../../src/infrastructure/persistence/prisma/PrismaTeachingAssignmentGeneratorRepository';
import { prismaTest } from '../../../helpers/prismaTestClient.ts';
import { creerEcoleTest, nettoyerEcole } from '../../../helpers/dbFixtures.ts';

let schoolId: string;
let academicYearId: string;
let classId: string;
let subjectId: string;
let teacherId: string;

beforeAll(async () => {
  const school = await creerEcoleTest(prismaTest, 'atomicite-affectations');
  schoolId = school.id;

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  academicYearId = annee.id;

  const cls = await prismaTest.class.create({
    data: { schoolId, academicYearId, name: '6e A', level: '6e', filiere: 'FR_GENERAL', capacity: 40, status: 'ACTIVE' },
  });
  classId = cls.id;

  const subject = await prismaTest.subject.create({
    data: { schoolId, name: 'Mathématiques', code: 'MATH', coefficient: 4, hoursPerWeek: 4, subjectType: 'THEORETICAL' },
  });
  subjectId = subject.id;

  const user = await prismaTest.user.create({
    data: { schoolId, role: 'TEACHER', firstName: 'Test', lastName: 'Prof', email: 'test-atomic@zekoulabia.cm', isActive: true, refreshTokenVersion: 0 },
  });
  teacherId = user.id;
  await prismaTest.teacherProfile.create({ data: { userId: user.id, specialization: [] } });
});

afterAll(async () => {
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('PrismaTeachingAssignmentGeneratorRepository — atomicité', () => {
  it('aucune affectation partielle ne persiste si le batch échoue', async () => {
    const repo = new PrismaTeachingAssignmentGeneratorRepository(prismaTest);

    // Le second assignment duplique le premier → violation de l'unicité classId/subjectId.
    const assignments = [
      { schoolId, academicYearId, classId, subjectId, teacherId },
      { schoolId, academicYearId, classId, subjectId, teacherId },
    ];

    await expect(repo.createAssignmentsInTransaction(assignments)).rejects.toBeDefined();

    const count = await prismaTest.teachingAssignment.count({
      where: { schoolId, academicYearId, classId, subjectId },
    });
    expect(count).toBe(0);
  });
});
