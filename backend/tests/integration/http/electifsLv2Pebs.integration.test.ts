/**
 * Test d'intégration — Routes LV2/PEBS (electifs.ts)
 * Vérifie que PATCH /students/:id/lv2, POST /students/lv2/bulk, PATCH /students/:id/pebs,
 * POST /students/pebs/bulk passent par les use cases et synchronisent StudentGroupMembership.
 * Non-régression : un test qui casse la sync (écriture Prisma directe sans synchroniserAppartenance*)
 * doit échouer — le membership est la preuve que la route passe par le use case.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
import { creerEleveAvecClasse } from '@application/shared/studentEnrollment';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

const enrollmentRepo = new PrismaEnrollmentRepository(prismaTest);

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET non défini — requis dans .env.test pour ce test.');
}

let server: Server;
let baseUrl: string;
let schoolId: string;
let adminToken: string;
let classId: string;
let academicYearId: string;
let studentAId: string;
let studentBId: string;
let lv2SubjectId: string;

const authHeaders = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  // Nettoyer les écoles de test orphelines des runs précédents
  const oldSchools = await prismaTest.school.findMany({ where: { name: { startsWith: 'Lycée Test electifs' } } });
  for (const s of oldSchools) {
    await prismaTest.studentGroupMembership.deleteMany({ where: { studentProfile: { user: { schoolId: s.id } } } });
    await prismaTest.studentGroup.deleteMany({ where: { groupSet: { schoolId: s.id } } });
    await prismaTest.studentGroupSet.deleteMany({ where: { schoolId: s.id } });
    await prismaTest.enrollment.deleteMany({ where: { schoolId: s.id } });
    await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId: s.id } } });
    await prismaTest.class.deleteMany({ where: { schoolId: s.id } });
    await prismaTest.academicYear.deleteMany({ where: { schoolId: s.id } });
    await prismaTest.subject.deleteMany({ where: { schoolId: s.id } });
    await prismaTest.user.deleteMany({ where: { schoolId: s.id } });
    await nettoyerEcole(prismaTest, s.id);
  }

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'electifs');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isCurrent: true },
  });
  academicYearId = annee.id;
  const classe = await prismaTest.class.create({ data: { schoolId, academicYearId: annee.id, name: '3ème Electifs', level: '3ème' } });
  classId = classe.id;

  const lv2 = await prismaTest.subject.create({ data: { schoolId, name: 'Allemand', isLV2: true } });
  lv2SubjectId = lv2.id;

  const studentA = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'electif-a' });
  studentAId = studentA.id;
  await creerEleveAvecClasse(enrollmentRepo, { userId: studentA.id, classId, enrolledById: studentA.id });

  const studentB = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'electif-b' });
  studentBId = studentB.id;
  await creerEleveAvecClasse(enrollmentRepo, { userId: studentB.id, classId, enrolledById: studentB.id });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.studentGroupMembership.deleteMany({ where: { studentProfile: { user: { schoolId } } } });
  await prismaTest.studentGroup.deleteMany({ where: { groupSet: { schoolId } } });
  await prismaTest.studentGroupSet.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.academicPeriod.deleteMany({ where: { academicYearId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.subject.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

async function creerGroupSetLv2(): Promise<void> {
  // Group set LV2 avec un group lié à la matière Allemand pour vérifier la sync
  const existing = await prismaTest.studentGroupSet.findFirst({ where: { schoolId, code: 'LV2' } });
  if (existing) return;
  const gs = await prismaTest.studentGroupSet.create({
    data: { schoolId, name: 'LV2', code: 'LV2' },
  });
  await prismaTest.studentGroup.create({
    data: { groupSetId: gs.id, name: 'Allemand', subjectId: lv2SubjectId },
  });
}

async function creerGroupSetProgramme(): Promise<string> {
  // Replier sur le groupe set PROGRAMME pour vérifier la sync PEBS
  const existing = await prismaTest.studentGroupSet.findFirst({ where: { schoolId, code: 'PROGRAMME' } });
  if (existing) return existing.id;
  const gs = await prismaTest.studentGroupSet.create({
    data: { schoolId, name: 'Programme', code: 'PROGRAMME' },
  });
  await prismaTest.studentGroup.create({
    data: { groupSetId: gs.id, name: 'EN_PEBS' },
  });
  await prismaTest.studentGroup.create({
    data: { groupSetId: gs.id, name: 'FR_PEBS' },
  });
  return gs.id;
}

async function listerMemberships(studentUserId: string): Promise<{ groupSetCode: string | null; groupName: string | null }[]> {
  const profile = await prismaTest.studentProfile.findFirst({ where: { userId: studentUserId } });
  if (!profile) return [];
  const rows = await prismaTest.studentGroupMembership.findMany({
    where: { studentProfileId: profile.id },
    select: { group: { select: { groupSet: { select: { code: true } }, name: true } } },
  });
  return rows.map(r => ({ groupSetCode: r.group.groupSet?.code ?? null, groupName: r.group.name }));
}

describe('Electifs LV2/PEBS — sync StudentGroupMembership via use cases', () => {
  it('PATCH /students/:id/lv2 affecte la LV2 et crée le membership de groupe', async () => {
    await creerGroupSetLv2();
    const res = await fetch(`${baseUrl}/students/${studentAId}/lv2`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ lv2SubjectId }),
    });
    expect(res.status).toBe(200);

    const profile = await prismaTest.studentProfile.findFirst({ where: { userId: studentAId } });
    expect(profile?.lv2SubjectId).toBe(lv2SubjectId);
    // Le membership LV2 doit exister (preuve que le use case a synchronisé)
    const m = await prismaTest.studentGroupMembership.findFirst({
      where: { studentProfileId: profile!.id, group: { subjectId: lv2SubjectId } },
    });
    expect(m).not.toBeNull();
  });

  it('POST /students/lv2/bulk affecte la LV2 à plusieurs élèves et crée les memberships', async () => {
    await creerGroupSetLv2();
    const res = await fetch(`${baseUrl}/students/lv2/bulk`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ studentUserIds: [studentAId, studentBId], lv2SubjectId }),
    });
    expect(res.status).toBe(200);

    for (const sid of [studentAId, studentBId]) {
      const profile = await prismaTest.studentProfile.findFirst({ where: { userId: sid } });
      expect(profile?.lv2SubjectId).toBe(lv2SubjectId);
      const m = await prismaTest.studentGroupMembership.findFirst({
        where: { studentProfileId: profile!.id, group: { subjectId: lv2SubjectId } },
      });
      expect(m).not.toBeNull();
    }
  });

  it('PATCH /students/:id/pebs affecte la filière PEBS et crée le membership PROGRAMME', async () => {
    const groupSetId = await creerGroupSetProgramme();

    const res = await fetch(`${baseUrl}/students/${studentAId}/pebs`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ pebsFiliere: 'EN_PEBS' }),
    });
    expect(res.status).toBe(200);

    const profile = await prismaTest.studentProfile.findFirst({ where: { userId: studentAId } });
    expect(profile?.pebsFiliere).toBe('EN_PEBS');

    const m = await prismaTest.studentGroupMembership.findFirst({
      where: { studentProfileId: profile!.id, group: { groupSetId, name: 'EN_PEBS' } },
    });
    expect(m).not.toBeNull();
  });

  it('POST /students/pebs/bulk affecte la filière PEBS en masse et crée les memberships', async () => {
    const groupSetId = await creerGroupSetProgramme();

    const res = await fetch(`${baseUrl}/students/pebs/bulk`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ studentUserIds: [studentAId, studentBId], pebsFiliere: 'FR_PEBS' }),
    });
    expect(res.status).toBe(200);

    for (const sid of [studentAId, studentBId]) {
      const profile = await prismaTest.studentProfile.findFirst({ where: { userId: sid } });
      expect(profile?.pebsFiliere).toBe('FR_PEBS');
      const m = await prismaTest.studentGroupMembership.findFirst({
        where: { studentProfileId: profile!.id, group: { groupSetId, name: 'FR_PEBS' } },
      });
      expect(m).not.toBeNull();
    }
  });
});