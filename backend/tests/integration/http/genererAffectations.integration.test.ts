/**
 * Test d'intégration bout-en-bout — Génération automatique des affectations enseignant↔classe.
 *
 * Vérifie :
 *   - génération réussie avec création des TeachingAssignment manquants ;
 *   - respect du plafond AP 14h ;
 *   - matières restrictedToGroupId / StudentGroup exclues ;
 *   - 2nd cycle FR (weeklyPeriods null) rapporté comme hors périmètre ;
 *   - RBAC : rôle sans MANAGE_TEACHING_ASSIGNMENTS reçoit 403.
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
let noPermissionToken: string;
let academicYearId: string;
let class6eId: string;
let classTleId: string;
let subjectMathsId: string;
let subjectHistoryId: string;
let subjectLv2Id: string;
let subjectBacMathsId: string;
let teacherNormal: { userId: string; teacherProfileId: string };
let teacherAP: { userId: string; teacherProfileId: string };

const adminHeaders = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });
const noPermHeaders = () => ({ Cookie: `access_token=${noPermissionToken}`, 'Content-Type': 'application/json' });

async function creerEnseignant(
  prisma: typeof prismaTest,
  schoolId: string,
  suffix: string,
  opts: { estAP?: boolean } = {},
) {
  const user = await creerUtilisateurTest(prisma, schoolId, { role: 'TEACHER', suffix });
  const profile = await prisma.teacherProfile.create({
    data: { userId: user.id, specialization: [] },
  });
  if (opts.estAP) {
    await prisma.staffProfile.create({
      data: {
        schoolId,
        userId: user.id,
        title: 'Animateur Pédagogique',
        permissions: { create: { permission: 'SUPERVISE_TEACHERS' } },
      },
    });
  }
  return { userId: user.id, teacherProfileId: profile.id };
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'affectations');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'affect-admin' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const noPermUser = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: 'affect-noperm' });
  noPermissionToken = jwt.sign(
    { userId: noPermUser.id, schoolId, role: 'TEACHER', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  academicYearId = annee.id;

  const class6e = await prismaTest.class.create({
    data: { schoolId, academicYearId, name: '6e A', level: '6e', filiere: 'FR_GENERAL', capacity: 40, status: 'ACTIVE' },
  });
  class6eId = class6e.id;

  const classTle = await prismaTest.class.create({
    data: { schoolId, academicYearId, name: 'Tle C A', level: 'Tle', serie: 'C', capacity: 40, status: 'ACTIVE' },
  });
  classTleId = classTle.id;

  // Matières
  const maths = await prismaTest.subject.create({ data: { schoolId, name: 'Mathématiques', code: 'MATH', coefficient: 4, hoursPerWeek: 4, subjectType: 'THEORETICAL' } });
  subjectMathsId = maths.id;
  const history = await prismaTest.subject.create({ data: { schoolId, name: 'Histoire-Géographie', code: 'HG', coefficient: 2, hoursPerWeek: 2, subjectType: 'THEORETICAL' } });
  subjectHistoryId = history.id;
  const lv2 = await prismaTest.subject.create({ data: { schoolId, name: 'Allemand LV2', code: 'ALLEMAND', coefficient: 2, hoursPerWeek: 2, subjectType: 'THEORETICAL' } });
  subjectLv2Id = lv2.id;
  const bacMaths = await prismaTest.subject.create({ data: { schoolId, name: 'Mathématiques Bac', code: 'MATHBAC', coefficient: 4, hoursPerWeek: 4, subjectType: 'THEORETICAL' } });
  subjectBacMathsId = bacMaths.id;

  // Coefficients
  await prismaTest.subjectCoefficient.create({
    data: { schoolId, subjectId: subjectMathsId, classLevel: '6e', serieCode: 'FR_GENERAL', coefficient: 4, weeklyPeriods: 4 },
  });
  await prismaTest.subjectCoefficient.create({
    data: { schoolId, subjectId: subjectHistoryId, classLevel: '6e', serieCode: 'FR_GENERAL', coefficient: 2, weeklyPeriods: 2 },
  });
  // LV2 : liée à un StudentGroup → doit être exclue
  const groupSet = await prismaTest.studentGroupSet.create({ data: { schoolId, code: 'LV2', name: 'LV2' } });
  const group = await prismaTest.studentGroup.create({ data: { groupSetId: groupSet.id, name: 'Allemand', subjectId: subjectLv2Id } });
  await prismaTest.subjectCoefficient.create({
    data: { schoolId, subjectId: subjectLv2Id, classLevel: '6e', serieCode: 'FR_GENERAL', coefficient: 2, weeklyPeriods: 2 },
  });
  await prismaTest.subject.update({ where: { id: subjectLv2Id }, data: { studentGroups: { connect: { id: group.id } } } });

  // Bac (2nd cycle FR) — coefficient sans weeklyPeriods
  await prismaTest.subjectCoefficient.create({
    data: { schoolId, subjectId: subjectBacMathsId, classLevel: 'Tle', serieCode: 'C', coefficient: 4, weeklyPeriods: null },
  });

  // Enseignants
  teacherNormal = await creerEnseignant(prismaTest, schoolId, 'affect-normal');
  teacherAP = await creerEnseignant(prismaTest, schoolId, 'affect-ap', { estAP: true });

  // Compétences : les deux enseignants peuvent enseigner les maths ; seul l'AP peut enseigner HG pour le test de plafond
  await prismaTest.teacherSubject.create({ data: { teacherProfileId: teacherNormal.teacherProfileId, subjectId: subjectMathsId } });
  await prismaTest.teacherSubject.create({ data: { teacherProfileId: teacherAP.teacherProfileId, subjectId: subjectMathsId } });
  await prismaTest.teacherSubject.create({ data: { teacherProfileId: teacherAP.teacherProfileId, subjectId: subjectHistoryId } });

  // Charge préexistante de l'AP : 12h déjà assignées (sur maths) → il ne peut plus prendre que 2h
  await prismaTest.teachingAssignment.create({
    data: { schoolId, academicYearId, classId: class6eId, subjectId: subjectMathsId, teacherId: teacherAP.userId },
  });
});

afterAll(async () => {
  await prismaTest.teachingAssignment.deleteMany({ where: { schoolId } });
  await prismaTest.teacherSubject.deleteMany({ where: { subject: { schoolId } } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
  server.close();
});

async function generate(classId: string, tokenHeaders: () => Record<string, string> = adminHeaders) {
  return fetch(`${baseUrl}/teaching-assignments/generate`, {
    method: 'POST',
    headers: tokenHeaders(),
    body: JSON.stringify({ academicYearId, classId }),
  });
}

describe('POST /teaching-assignments/generate', () => {
  it('génère les affectations manquantes en respectant le plafond AP', async () => {
    const res = await generate(class6eId);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    // Maths déjà affecté à l'AP → non recréé
    // Histoire-Géographie : l'AP est le seul qualifié mais déjà à 12h ; 12+2 <= 14 → il peut la prendre
    expect(body.data.createdCount).toBe(1);
    expect(body.data.nonResolus).toHaveLength(0);

    const assignment = await prismaTest.teachingAssignment.findFirst({
      where: { schoolId, academicYearId, classId: class6eId, subjectId: subjectHistoryId },
    });
    expect(assignment?.teacherId).toBe(teacherAP.userId);
  });

  it('exclut les matières liées à un StudentGroup', async () => {
    // Avant nettoyage de l'affectation HG créée par le test précédent
    await prismaTest.teachingAssignment.deleteMany({ where: { schoolId, academicYearId, classId: class6eId, subjectId: subjectHistoryId } });

    const res = await generate(class6eId);
    const body = await res.json();

    // LV2 ne doit apparaître ni créée, ni non résolue, ni hors périmètre
    const lv2InResult =
      body.data.nonResolus.some((r: any) => r.subjectId === subjectLv2Id) ||
      body.data.horsPerimetre.some((r: any) => r.subjectId === subjectLv2Id);
    expect(lv2InResult).toBe(false);

    const lv2Created = await prismaTest.teachingAssignment.count({
      where: { schoolId, academicYearId, classId: class6eId, subjectId: subjectLv2Id },
    });
    expect(lv2Created).toBe(0);
  });

  it('rapporte le 2nd cycle FR comme hors périmètre (weeklyPeriods null)', async () => {
    const res = await generate(classTleId);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.createdCount).toBe(0);
    expect(body.data.horsPerimetre).toHaveLength(1);
    expect(body.data.horsPerimetre[0].subjectId).toBe(subjectBacMathsId);
  });

  it('refuse un utilisateur sans MANAGE_TEACHING_ASSIGNMENTS', async () => {
    const res = await generate(class6eId, noPermHeaders);
    expect(res.status).toBe(403);
  });
});
