/**
 * Test d'intégration — V1.13 « Reporting initial » (StatisticsController).
 * Vérifie sur la vraie base que les 4 endpoints de statistiques agrègent correctement :
 *  - grades-evolution : moyenne par séquence de l'année courante, notes DRAFT exclues ;
 *  - classes-comparison : moyenne par classe ;
 *  - students-distribution : répartition gender / level / paymentStatus ;
 *  - teacher-performance : heures, taux de présence, moyennes par classe,
 *    ET isolation multi-tenant (teacherId d'une autre école → 404).
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { creerEleveAvecClasse } from '@application/shared/studentEnrollment';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
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
let schoolBId: string;
let adminToken: string;
let adminBToken: string;
let classAId: string;
let classBId: string;
let academicYearId: string;
let subjectId: string;
let teacherId: string;
let studentAId: string;
let studentBId: string;

const headers = (token: string) => ({ Cookie: `access_token=${token}`, 'Content-Type': 'application/json' });

const signer = (userId: string, ecoleId: string, role: string) =>
  jwt.sign(
    { userId, schoolId: ecoleId, role, permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

const get = (path: string, token: string) =>
  fetch(`${baseUrl}/statistics/${path}`, { method: 'GET', headers: headers(token) });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'statsReport');
  schoolId = school.id;
  const schoolB = await creerEcoleTest(prismaTest, 'statsReportB');
  schoolBId = schoolB.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = signer(admin.id, schoolId, 'ADMIN');
  const adminB = await creerUtilisateurTest(prismaTest, schoolBId, { role: 'ADMIN' });
  adminBToken = signer(adminB.id, schoolBId, 'ADMIN');

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isCurrent: true },
  });
  academicYearId = annee.id;

  const classeA = await prismaTest.class.create({ data: { schoolId, academicYearId, name: '6e A', level: '6e' } });
  classAId = classeA.id;
  const classeB = await prismaTest.class.create({ data: { schoolId, academicYearId, name: '6e B', level: '6e' } });
  classBId = classeB.id;

  const subject = await prismaTest.subject.create({ data: { schoolId, name: 'Mathématiques', code: 'MATH', hoursPerWeek: 4 } });
  subjectId = subject.id;

  const teacher = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: 'stats-teach' });
  teacherId = teacher.id;
  await prismaTest.teachingAssignment.create({
    data: { classId: classAId, subjectId, teacherId, schoolId, academicYearId },
  });

  const studentA = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'stats-a' });
  studentAId = studentA.id;
  await creerEleveAvecClasse(enrollmentRepo, { userId: studentA.id, classId: classAId, enrolledById: studentA.id });
  const studentB = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'stats-b' });
  studentBId = studentB.id;
  await creerEleveAvecClasse(enrollmentRepo, { userId: studentB.id, classId: classBId, enrolledById: studentB.id });

  const periode = await prismaTest.academicPeriod.create({
    data: { name: 'Trimestre 1', academicYearId, orderIndex: 1, startDate: new Date('2025-09-01'), endDate: new Date('2025-12-15') },
  });
  const seq1 = await prismaTest.academicSequence.create({
    data: { academicPeriodId: periode.id, schoolId, name: 'Séquence 1', orderIndex: 1, type: 'DS' },
  });
  const seq2 = await prismaTest.academicSequence.create({
    data: { academicPeriodId: periode.id, schoolId, name: 'Séquence 2', orderIndex: 2, type: 'COMPOSITION' },
  });

  // Notes LOCKED (séquence 1 et 2) — comptées
  await prismaTest.grade.createMany({
    data: [
      { schoolId, studentId: studentAId, subjectId, classId: classAId, academicYearId, sequenceId: seq1.id, sequenceAverage: 14, validationStatus: 'LOCKED' },
      { schoolId, studentId: studentBId, subjectId, classId: classBId, academicYearId, sequenceId: seq1.id, sequenceAverage: 12, validationStatus: 'LOCKED' },
      { schoolId, studentId: studentAId, subjectId, classId: classAId, academicYearId, sequenceId: seq2.id, sequenceAverage: 16, validationStatus: 'LOCKED' },
      // DRAFT — doit être exclue de tout agrégat
      { schoolId, studentId: studentBId, subjectId, classId: classBId, academicYearId, sequenceId: seq2.id, sequenceAverage: 18, validationStatus: 'DRAFT' },
    ],
  });

  // Présences pour teacher-performance : 3 séances dont 1 absente
  await prismaTest.attendance.createMany({
    data: [
      { schoolId, studentId: studentAId, classId: classAId, date: new Date('2025-09-08'), status: 'PRESENT', teacherId, subjectId },
      { schoolId, studentId: studentAId, classId: classAId, date: new Date('2025-09-09'), status: 'PRESENT', teacherId, subjectId },
      { schoolId, studentId: studentAId, classId: classAId, date: new Date('2025-09-10'), status: 'ABSENT', teacherId, subjectId },
    ],
  });

  // Profils studentProfile (gender) — créés par creerEleveAvecClasse ? compléter si besoin
  await prismaTest.studentProfile.updateMany({ where: { userId: studentAId }, data: { gender: 'M' } });
  await prismaTest.studentProfile.updateMany({ where: { userId: studentBId }, data: { gender: 'F' } });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.grade.deleteMany({ where: { schoolId } });
  await prismaTest.attendance.deleteMany({ where: { schoolId } });
  await prismaTest.teachingAssignment.deleteMany({ where: { schoolId } });
  await prismaTest.subject.deleteMany({ where: { schoolId } });
  await prismaTest.academicSequence.deleteMany({ where: { schoolId } });
  await prismaTest.academicPeriod.deleteMany({ where: { academicYearId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await nettoyerEcole(prismaTest, schoolBId);
});

describe('V1.13 — StatisticsController', () => {
  it('grades-evolution : moyenne par séquence triée, notes DRAFT exclues', async () => {
    const res = await get('grades-evolution', adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ sequenceName: string; moyenne: number; nbNotes: number }> };
    // Séquence 1 : (14+12)/2 = 13 ; Séquence 2 : seul 16 (la 18 DRAFT est exclue)
    expect(body.data).toHaveLength(2);
    expect(body.data[0]).toMatchObject({ sequenceName: 'Séquence 1', moyenne: 13, nbNotes: 2 });
    expect(body.data[1]).toMatchObject({ sequenceName: 'Séquence 2', moyenne: 16, nbNotes: 1 });
  });

  it('grades-evolution : filtre par classId', async () => {
    const res = await get(`grades-evolution?classId=${classAId}`, adminToken);
    const body = await res.json() as { data: Array<{ moyenne: number; nbNotes: number }> };
    expect(body.data[0]).toMatchObject({ moyenne: 14, nbNotes: 1 }); // 6e A : seul l'élève A
  });

  it('classes-comparison : moyenne par classe', async () => {
    const res = await get('classes-comparison', adminToken);
    const body = await res.json() as { data: Array<{ className: string; moyenne: number | null; nbEleves: number }> };
    expect(body.data).toHaveLength(2);
    const classeA = body.data.find((d) => d.className === '6e A')!;
    const classeB = body.data.find((d) => d.className === '6e B')!;
    // 6e A : élève A seq1 14 + seq2 16 → 15 ; 6e B : élève B seq1 12 (la 18 DRAFT exclue)
    expect(classeA.moyenne).toBe(15);
    expect(classeA.nbEleves).toBe(1);
    expect(classeB.moyenne).toBe(12);
    expect(classeB.nbEleves).toBe(1);
  });

  it('students-distribution : gender', async () => {
    const res = await get('students-distribution?criteria=gender', adminToken);
    const body = await res.json() as { data: Array<{ label: string; count: number }> };
    const counts = Object.fromEntries(body.data.map((d) => [d.label, d.count]));
    expect(counts['M']).toBe(1);
    expect(counts['F']).toBe(1);
  });

  it('students-distribution : level', async () => {
    const res = await get('students-distribution?criteria=level', adminToken);
    const body = await res.json() as { data: Array<{ label: string; count: number }> };
    const counts = Object.fromEntries(body.data.map((d) => [d.label, d.count]));
    expect(counts['6e']).toBe(2);
  });

  it('students-distribution : critère invalide → 400', async () => {
    const res = await get('students-distribution?criteria=inconnu', adminToken);
    expect(res.status).toBe(400);
  });

  it('teacher-performance : heures, présence, moyennes par classe', async () => {
    const res = await get(`teacher-performance/${teacherId}`, adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: {
      teacherName: string; heuresPrevuesParSemaine: number; tauxPresence: number | null;
      seancesEnregistrees: number; moyennesParClasse: Array<{ className: string; moyenne: number | null }>;
    } };
    expect(body.data.heuresPrevuesParSemaine).toBe(4);
    expect(body.data.seancesEnregistrees).toBe(3);
    expect(body.data.tauxPresence).toBe(66.67);
    expect(body.data.moyennesParClasse[0]).toMatchObject({ className: '6e A' });
  });

  it('isolation multi-tenant : teacherId d\'une autre école → 404', async () => {
    const res = await get(`teacher-performance/${teacherId}`, adminBToken);
    expect(res.status).toBe(404);
  });

  it('RBAC : STAFF autorisé, Élève refusé (requireRole ADMIN,STAFF)', async () => {
    const staff = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STAFF' });
    const staffToken = signer(staff.id, schoolId, 'STAFF');
    expect((await get('grades-evolution', staffToken)).status).toBe(200);

    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
    const studentToken = signer(student.id, schoolId, 'STUDENT');
    expect((await get('grades-evolution', studentToken)).status).toBe(403);
  });
});