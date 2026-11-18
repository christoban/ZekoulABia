import { describe, it, expect, afterEach } from 'bun:test';
import { Bulletin } from '@domain/entities/Bulletin';
import { PrismaBulletinRepository } from '@infrastructure/persistence/prisma/PrismaBulletinRepository';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

const repo = new PrismaBulletinRepository(prismaTest);

async function setupFixtures(suffix: string) {
  const school = await creerEcoleTest(prismaTest, `revocation-${suffix}`);
  const studentA = await creerUtilisateurTest(prismaTest, school.id, { role: 'STUDENT', suffix: `a-${suffix}` });
  const studentB = await creerUtilisateurTest(prismaTest, school.id, { role: 'STUDENT', suffix: `b-${suffix}` });
  const admin = await creerUtilisateurTest(prismaTest, school.id, { role: 'ADMIN', suffix: `adm-${suffix}` });

  const year = await prismaTest.academicYear.create({
    data: {
      schoolId: school.id,
      name: `2025-2026-${suffix}`,
      startDate: new Date('2025-09-01'),
      endDate: new Date('2026-07-01'),
      isCurrent: true,
    },
  });
  const period = await prismaTest.academicPeriod.create({
    data: {
      academicYearId: year.id,
      name: 'Trimestre 1',
      type: 'TRIMESTER',
      orderIndex: 1,
      startDate: new Date('2025-09-01'),
      endDate: new Date('2025-12-15'),
      isCurrent: true,
    },
  });
  const subject = await prismaTest.subject.create({
    data: { schoolId: school.id, name: 'Mathématiques', coefficient: 4, hoursPerWeek: 5 },
  });

  return { school, studentA, studentB, admin, year, period, subject };
}

function buildSealedBulletin(params: {
  schoolId: string;
  studentId: string;
  academicYearId: string;
  academicPeriodId: string;
  subjectId: string;
  average: number;
  verifyToken: string;
  computationVersion: number;
}): Bulletin {
  const bulletin = Bulletin.create({
    schoolId: params.schoolId,
    studentId: params.studentId,
    academicYearId: params.academicYearId,
    academicPeriodId: params.academicPeriodId,
    template: 'FR_SECONDARY',
  });
  bulletin.definirLignesMatiere([
    {
      id: crypto.randomUUID(),
      subjectId: params.subjectId,
      subjectName: 'Mathématiques',
      coefficient: 4,
      seq1Score: params.average,
      subjectAverage: params.average,
      weightedScore: params.average * 4,
      subjectRank: 1,
      groupKey: 'SCI',
      groupLabel: 'Sciences',
      groupOrder: 1,
    },
  ]);
  bulletin.definirResultats({
    generalAverage: params.average,
    rank: 1,
    totalStudents: 1,
    mention: 'Bien',
    absenceCount: 0,
  });
  bulletin.scellerSnapshot({
    snapshotData: { generalAverage: params.average, computationVersion: params.computationVersion },
    contentHash: `hash-${params.verifyToken}`,
    verifyToken: params.verifyToken,
    computationVersion: params.computationVersion,
    templateVersion: 1,
  });
  bulletin.marquerGenere(`bulletins/${params.schoolId}/${bulletin.id}.pdf`);
  return bulletin;
}

describe('PostgreSQL — archiverEtRemplacerRevoque & contraintes ReportCard', () => {
  const createdSchoolIds: string[] = [];

  afterEach(async () => {
    for (const schoolId of createdSchoolIds.splice(0)) {
      await prismaTest.bulletinRevocationArchive.deleteMany({ where: { schoolId } });
      await prismaTest.reportCard.deleteMany({ where: { schoolId } });
      await prismaTest.academicPeriod.deleteMany({ where: { academicYear: { schoolId } } });
      await prismaTest.academicYear.deleteMany({ where: { schoolId } });
      await prismaTest.subject.deleteMany({ where: { schoolId } });
      await prismaTest.user.deleteMany({ where: { schoolId } });
      await nettoyerEcole(prismaTest, schoolId);
    }
  });

  it('archive le bulletin révoqué et insère le remplacement v2 dans une transaction atomique', async () => {
    const { school, studentA, admin, year, period, subject } = await setupFixtures('commit');
    createdSchoolIds.push(school.id);

    const oldToken = `tok-v1-${Date.now()}`;
    const v1 = buildSealedBulletin({
      schoolId: school.id,
      studentId: studentA.id,
      academicYearId: year.id,
      academicPeriodId: period.id,
      subjectId: subject.id,
      average: 13.5,
      verifyToken: oldToken,
      computationVersion: 1,
    });
    await repo.save(v1);

    v1.revoquer({ revokedById: admin.id, reason: 'Erreur note seq1 corrigée' });
    const newToken = `tok-v2-${Date.now()}`;
    const v2 = buildSealedBulletin({
      schoolId: school.id,
      studentId: studentA.id,
      academicYearId: year.id,
      academicPeriodId: period.id,
      subjectId: subject.id,
      average: 15.25,
      verifyToken: newToken,
      computationVersion: 2,
    });

    await repo.archiverEtRemplacerRevoque(v1, v2);

    const active = await repo.findByEleveEtPeriode(studentA.id, period.id);
    expect(active).not.toBeNull();
    expect(active!.id).toBe(v2.id);
    expect(active!.computationVersion).toBe(2);
    expect(active!.generalAverage).toBe(15.25);
    expect(active!.verifyToken).toBe(newToken);
    expect(active!.lignesMatiere).toHaveLength(1);

    const oldRow = await repo.findById(v1.id);
    expect(oldRow).toBeNull();

    const archives = await repo.findRevocationsByStudent(school.id, studentA.id);
    expect(archives).toHaveLength(1);
    expect(archives[0]!.originalReportCardId).toBe(v1.id);
    expect(archives[0]!.computationVersion).toBe(1);
    expect(archives[0]!.generalAverage).toBe(13.5);
    expect(archives[0]!.verifyToken).toBe(oldToken);
    expect(archives[0]!.revokedById).toBe(admin.id);
    expect(archives[0]!.revocationReason).toBe('Erreur note seq1 corrigée');
  });

  it('effectue un rollback complet si la création du remplacement échoue (verifyToken déjà pris)', async () => {
    const { school, studentA, studentB, admin, year, period, subject } = await setupFixtures('rollback');
    createdSchoolIds.push(school.id);

    const takenToken = `tok-taken-${Date.now()}`;
    const bA = buildSealedBulletin({
      schoolId: school.id,
      studentId: studentA.id,
      academicYearId: year.id,
      academicPeriodId: period.id,
      subjectId: subject.id,
      average: 12,
      verifyToken: takenToken,
      computationVersion: 2,
    });
    const bB = buildSealedBulletin({
      schoolId: school.id,
      studentId: studentB.id,
      academicYearId: year.id,
      academicPeriodId: period.id,
      subjectId: subject.id,
      average: 14,
      verifyToken: `tok-b-${Date.now()}`,
      computationVersion: 1,
    });
    await repo.save(bA);
    await repo.save(bB);

    bB.revoquer({ revokedById: admin.id, reason: 'Test rollback' });
    const conflictingReplacement = buildSealedBulletin({
      schoolId: school.id,
      studentId: studentB.id,
      academicYearId: year.id,
      academicPeriodId: period.id,
      subjectId: subject.id,
      average: 16,
      verifyToken: takenToken, // Collision volontaire avec bA -> doit annuler delete + archive !
      computationVersion: 2,
    });

    await expect(repo.archiverEtRemplacerRevoque(bB, conflictingReplacement)).rejects.toThrow();

    const archives = await repo.findRevocationsByStudent(school.id, studentB.id);
    expect(archives).toHaveLength(0);

    const intactB = await repo.findById(bB.id);
    expect(intactB).not.toBeNull();
    expect(intactB!.generalAverage).toBe(14);
    expect(intactB!.lignesMatiere).toHaveLength(1);
  });

  it('rejette deux bulletins actifs sur (studentId, academicPeriodId) avec P2002', async () => {
    const { school, studentA, year, period, subject } = await setupFixtures('uniq-period');
    createdSchoolIds.push(school.id);

    const b1 = buildSealedBulletin({
      schoolId: school.id, studentId: studentA.id, academicYearId: year.id, academicPeriodId: period.id,
      subjectId: subject.id, average: 11, verifyToken: `tok-1-${Date.now()}`, computationVersion: 2,
    });
    const b2 = buildSealedBulletin({
      schoolId: school.id, studentId: studentA.id, academicYearId: year.id, academicPeriodId: period.id,
      subjectId: subject.id, average: 12, verifyToken: `tok-2-${Date.now()}`, computationVersion: 2,
    });
    await repo.save(b1);

    let code: string | undefined;
    try {
      await repo.save(b2);
    } catch (err) {
      code = (err as { code?: string }).code;
    }
    expect(code).toBe('P2002');
  });

  it('rejette deux bulletins partageant le même verifyToken avec P2002', async () => {
    const { school, studentA, studentB, year, period, subject } = await setupFixtures('uniq-token');
    createdSchoolIds.push(school.id);

    const sharedToken = `tok-shared-${Date.now()}`;
    const b1 = buildSealedBulletin({
      schoolId: school.id, studentId: studentA.id, academicYearId: year.id, academicPeriodId: period.id,
      subjectId: subject.id, average: 11, verifyToken: sharedToken, computationVersion: 2,
    });
    const b2 = buildSealedBulletin({
      schoolId: school.id, studentId: studentB.id, academicYearId: year.id, academicPeriodId: period.id,
      subjectId: subject.id, average: 13, verifyToken: sharedToken, computationVersion: 2,
    });
    await repo.save(b1);

    let code: string | undefined;
    try {
      await repo.save(b2);
    } catch (err) {
      code = (err as { code?: string }).code;
    }
    expect(code).toBe('P2002');
  });
});
