/**
 * Test d'intégration — validation en temps réel des affectations manuelles.
 *
 * Vérifie que le Censeur est bloqué avec suggestions quand il choisit un AP
 * qui dépasserait 14h, et que les enseignants non-AP ne sont pas concernés.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET non défini — requis dans .env.test pour ce test.');
}

let server: Server;
let baseUrl: string;
let schoolId: string;
let adminToken: string;
let academicYearId: string;
let classId: string;
let subjectMathsId: string;
let subjectHistoryId: string;
let teacherAPId: string;
let teacherNormalId: string;

const headers = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'affect-manuelle');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'affect-manuelle-admin' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  academicYearId = annee.id;

  const cls = await prismaTest.class.create({
    data: { schoolId, academicYearId, name: '6e A', level: '6e', filiere: 'FR_GENERAL', capacity: 40, status: 'ACTIVE' },
  });
  classId = cls.id;

  const maths = await prismaTest.subject.create({ data: { schoolId, name: 'Mathématiques', code: 'MATH', coefficient: 4, hoursPerWeek: 4, subjectType: 'THEORETICAL' } });
  subjectMathsId = maths.id;
  const history = await prismaTest.subject.create({ data: { schoolId, name: 'Histoire-Géographie', code: 'HG', coefficient: 2, hoursPerWeek: 2, subjectType: 'THEORETICAL' } });
  subjectHistoryId = history.id;

  await prismaTest.subjectCoefficient.create({ data: { schoolId, subjectId: subjectMathsId, classLevel: '6e', serieCode: 'FR_GENERAL', coefficient: 4, weeklyPeriods: 4 } });
  await prismaTest.subjectCoefficient.create({ data: { schoolId, subjectId: subjectHistoryId, classLevel: '6e', serieCode: 'FR_GENERAL', coefficient: 2, weeklyPeriods: 2 } });

  const apUser = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: 'affect-manuelle-ap' });
  teacherAPId = apUser.id;
  const apProfile = await prismaTest.teacherProfile.create({ data: { userId: apUser.id, specialization: [] } });
  await prismaTest.staffProfile.create({
    data: { schoolId, userId: apUser.id, title: 'AP', permissions: { create: { permission: 'SUPERVISE_TEACHERS' } } },
  });
  await prismaTest.teacherSubject.create({ data: { teacherProfileId: apProfile.id, subjectId: subjectHistoryId } });

  const normalUser = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: 'affect-manuelle-normal' });
  teacherNormalId = normalUser.id;
  const normalProfile = await prismaTest.teacherProfile.create({ data: { userId: normalUser.id, specialization: [] } });
  await prismaTest.teacherSubject.create({ data: { teacherProfileId: normalProfile.id, subjectId: subjectHistoryId } });

  // Charge préexistante de l'AP : 12h (il ne peut donc plus prendre l'HG de 2h ? 12+2=14, ok)
  // On met 13h pour forcer le dépassement avec 2h
  await prismaTest.teachingAssignment.create({
    data: { schoolId, academicYearId, classId, subjectId: subjectMathsId, teacherId: teacherAPId },
  });
  // Pour simuler une charge de 13h, on crée une matière de 9h supplémentaires
  const extraSubject = await prismaTest.subject.create({ data: { schoolId, name: 'Extra', code: 'EXTRA', coefficient: 1, hoursPerWeek: 9, subjectType: 'THEORETICAL' } });
  await prismaTest.subjectCoefficient.create({ data: { schoolId, subjectId: extraSubject.id, classLevel: '6e', serieCode: 'FR_GENERAL', coefficient: 1, weeklyPeriods: 9 } });
  const apProfile2 = await prismaTest.teacherProfile.findUnique({ where: { userId: apUser.id } });
  await prismaTest.teacherSubject.create({ data: { teacherProfileId: apProfile2!.id, subjectId: extraSubject.id } });
  await prismaTest.teachingAssignment.create({
    data: { schoolId, academicYearId, classId, subjectId: extraSubject.id, teacherId: teacherAPId },
  });
});

afterAll(async () => {
  await prismaTest.teachingAssignment.deleteMany({ where: { schoolId } });
  await prismaTest.teacherSubject.deleteMany({ where: { subject: { schoolId } } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
  server.close();
});

async function assign(subjectId: string, teacherId: string | null) {
  return fetch(`${baseUrl}/teaching-assignments`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ classId, subjectId, teacherId }),
  });
}

describe('POST /teaching-assignments — validation charge AP', () => {
  it('bloque avec suggestions quand un AP dépasserait 14h', async () => {
    const res = await assign(subjectHistoryId, teacherAPId);
    const body = await res.json();

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('AP_WEEKLY_CAP_EXCEEDED');
    expect(body.error.suggestions).toBeInstanceOf(Array);
    expect(body.error.suggestions.some((s: any) => s.teacherId === teacherNormalId)).toBe(true);
  });

  it('autorise l’affectation si l’enseignant n’est pas AP', async () => {
    const res = await assign(subjectHistoryId, teacherNormalId);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
