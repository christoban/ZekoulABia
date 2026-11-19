import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { creerEleveAvecClasse } from '@application/shared/studentEnrollment';
import { canonicalHashSnapshot, deriveShortVerifyCode } from '@domain/policies/BulletinVerifyCrypto';
import { genererVerifyToken } from '@application/reportCard/bulletinEnrichmentHelpers';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';

const enrollmentRepo = new PrismaEnrollmentRepository(prismaTest);

let server: Server;
let baseUrl: string;
let schoolId: string;
let adminToken: string;
let parentToken: string;
let bulletinId: string;
let longVerifyToken: string;
let shortVerifyCode: string;

beforeAll(async () => {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'verify-reprint-live');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'vr-adm' });
  const parent = await creerUtilisateurTest(prismaTest, schoolId, { role: 'PARENT', suffix: 'vr-par' });
  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'vr-stu' });

  const parentProfile = await prismaTest.parentProfile.create({ data: { userId: parent.id } });
  const year = await prismaTest.academicYear.create({
    data: { schoolId, name: '2026-2027', startDate: new Date('2026-09-01'), endDate: new Date('2027-06-30'), isCurrent: true },
  });
  const classe = await prismaTest.class.create({
    data: { schoolId, academicYearId: year.id, name: '3ème Bilingue Test', level: '3e' },
  });
  await creerEleveAvecClasse(enrollmentRepo, { userId: student.id, classId: classe.id, enrolledById: admin.id });
  const studentProfile = await prismaTest.studentProfile.findUniqueOrThrow({ where: { userId: student.id } });
  await prismaTest.parentStudent.create({
    data: { parentProfileId: parentProfile.id, studentProfileId: studentProfile.id },
  });

  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );
  parentToken = jwt.sign(
    { userId: parent.id, schoolId, role: 'PARENT', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const period = await prismaTest.academicPeriod.create({
    data: { academicYearId: year.id, name: 'Trimestre 1', orderIndex: 1, startDate: new Date('2026-09-01'), endDate: new Date('2026-12-15') },
  });
  const subject = await prismaTest.subject.create({
    data: { schoolId, name: 'Mathématiques Live', code: 'MATH', coefficient: 4, hoursPerWeek: 4 },
  });

  longVerifyToken = genererVerifyToken();
  shortVerifyCode = deriveShortVerifyCode(longVerifyToken);
  const snap: StudentBulletinSnapshot = {
    studentId: student.id,
    computationVersion: 2,
    templateVersion: 1,
    generalAverage: 16.25,
    totalCoefficient: 4,
    totalWeightedScore: 65,
    rank: 1,
    totalStudents: 35,
    studentIdentity: {
      studentId: student.id,
      fullName: `${student.lastName} ${student.firstName}`,
      firstName: student.firstName,
      lastName: student.lastName,
      matricule: 'MAT-PRIVE-99',
      dateOfBirth: null,
      placeOfBirth: null,
      gender: 'M',
      isRepeater: false,
      photoUrl: null,
    },
    subjectLines: [
      {
        subjectId: subject.id,
        subjectName: 'Mathématiques Live',
        coefficient: 4,
        groupKey: 'SCIENTIFIQUE',
        groupLabel: 'Matières Scientifiques',
        groupOrder: 1,
        seq1Score: 16.25,
        subjectAverage: 16.25,
        weightedScore: 65,
        subjectRank: 1,
        subjectTotalStudents: 35,
        classSubjectAverage: 12,
        minSubjectAverage: 6,
        maxSubjectAverage: 18,
      },
    ],
    groupSummaries: [
      {
        groupKey: 'SCIENTIFIQUE',
        groupLabel: 'Matières Scientifiques',
        groupOrder: 1,
        totalCoefficient: 4,
        totalWeightedScore: 65,
        groupAverage: 16.25,
        groupRank: 1,
        groupTotalStudents: 35,
      },
    ],
  };

  const rc = await prismaTest.reportCard.create({
    data: {
      schoolId,
      studentId: student.id,
      academicYearId: year.id,
      academicPeriodId: period.id,
      template: 'FR_SECONDARY',
      templateSpecId: 'GENERAL_GROUPED_V1',
      templateVersion: 1,
      computationVersion: 2,
      snapshotData: snap as unknown as import('@prisma/client').Prisma.InputJsonValue,
      contentHash: canonicalHashSnapshot(snap),
      verifyToken: longVerifyToken,
      shortVerifyCode,
      reprintCount: 0,
      generalAverage: 16.25,
      rank: 1,
      totalStudents: 35,
      mention: 'Très Bien',
      isGenerated: true,
      validationStatus: 'GENERATED',
    },
  });
  bulletinId = rc.id;
});

afterAll(async () => {
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  if (schoolId) {
    await prismaTest.aIActionAuditLog.deleteMany({ where: { schoolId } }).catch(() => {});
    await prismaTest.reportCard.deleteMany({ where: { schoolId } });
    await prismaTest.parentStudent.deleteMany({ where: { parentProfile: { user: { schoolId } } } });
    await prismaTest.parentProfile.deleteMany({ where: { user: { schoolId } } });
    await prismaTest.enrollment.deleteMany({ where: { schoolId } });
    await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId } } });
    await prismaTest.class.deleteMany({ where: { schoolId } });
    await prismaTest.subject.deleteMany({ where: { schoolId } });
    await prismaTest.academicPeriod.deleteMany({ where: { academicYear: { schoolId } } });
    await prismaTest.academicYear.deleteMany({ where: { schoolId } });
    await prismaTest.user.deleteMany({ where: { schoolId } });
    await nettoyerEcole(prismaTest, schoolId);
  }
});

describe('HTTP + PostgreSQL réel — /verify (jeton long vs code court) & POST /reprint audité', () => {
  it('GET /verify/:longToken retourne moyenne générale, rang et nom masqué (noindex), /verify/:shortCode retourne statut seul', async () => {
    const resLong = await fetch(`${baseUrl}/verify/${longVerifyToken}`);
    expect(resLong.status).toBe(200);
    expect(resLong.headers.get('x-robots-tag')).toContain('noindex');
    const jsonLong = (await resLong.json()) as { success: boolean; document: Record<string, unknown> };
    expect(jsonLong.success).toBe(true);
    expect(jsonLong.document.lookupMode).toBe('LONG_TOKEN');
    expect(jsonLong.document.status).toBe('AUTHENTIC');
    expect(jsonLong.document.generalAverage).toBe(16.25);
    expect(jsonLong.document.generalAverageDisplay).toBe('16,25 / 20');
    expect(jsonLong.document.rankDisplay).toBe('1er / 35');
    expect(jsonLong.document.className).toBe('3ème Bilingue Test');
    expect(JSON.stringify(jsonLong)).not.toContain('MAT-PRIVE-99');
    expect(JSON.stringify(jsonLong)).not.toContain('Mathématiques Live');

    // Recherche manuelle via code court -> statut seul, zéro chiffre
    const resShort = await fetch(`${baseUrl}/verify/${shortVerifyCode}`);
    expect(resShort.status).toBe(200);
    const jsonShort = (await resShort.json()) as { success: boolean; document: Record<string, unknown> };
    expect(jsonShort.document.lookupMode).toBe('SHORT_CODE');
    expect(jsonShort.document.status).toBe('AUTHENTIC');
    expect(jsonShort.document.generalAverage).toBeUndefined();
    expect(jsonShort.document.rank).toBeUndefined();
  });

  it('GET /pdf parent n’incrémente rien, POST /reprint exige motif + ADMIN, incrémente à 1 et reste à 1 après rechargement', async () => {
    // 1. Téléchargement simple par parent
    const parentGet = await fetch(`${baseUrl}/report-cards/${bulletinId}/pdf`, {
      headers: { Cookie: `access_token=${parentToken}` },
    });
    expect(parentGet.status).toBe(200);
    expect((await prismaTest.reportCard.findUnique({ where: { id: bulletinId } }))?.reprintCount).toBe(0);

    // 2. Parent refusé sur POST /reprint
    const parentPost = await fetch(`${baseUrl}/report-cards/${bulletinId}/reprint`, {
      method: 'POST',
      headers: { Cookie: `access_token=${parentToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ motif: 'Demande parent' }),
    });
    expect(parentPost.status).toBe(403);

    // 3. Admin sans motif -> 400
    const adminNoMotif = await fetch(`${baseUrl}/report-cards/${bulletinId}/reprint`, {
      method: 'POST',
      headers: { Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ motif: '' }),
    });
    expect(adminNoMotif.status).toBe(400);

    // 4. Admin avec motif -> 200 PDF + X-Reprint-Count: 1 + PDF non modifié lors d'un rechargement GET
    const adminOk = await fetch(`${baseUrl}/report-cards/${bulletinId}/reprint`, {
      method: 'POST',
      headers: { Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ motif: 'Original abîmé' }),
    });
    expect(adminOk.status).toBe(200);
    expect(adminOk.headers.get('x-reprint-count')).toBe('1');
    const pdfBytes = Buffer.from(await adminOk.arrayBuffer());
    expect(pdfBytes.subarray(0, 5).toString('utf8')).toBe('%PDF-');
    expect((await prismaTest.reportCard.findUnique({ where: { id: bulletinId } }))?.reprintCount).toBe(1);

    // Rechargement GET ultérieur -> compteur reste strictement à 1
    const reloadGet = await fetch(`${baseUrl}/report-cards/${bulletinId}/pdf`, {
      headers: { Cookie: `access_token=${adminToken}` },
    });
    expect(reloadGet.status).toBe(200);
    expect((await prismaTest.reportCard.findUnique({ where: { id: bulletinId } }))?.reprintCount).toBe(1);
  });
});
