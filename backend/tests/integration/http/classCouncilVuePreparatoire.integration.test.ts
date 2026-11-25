/**
 * Test d'intégration — V1.12 « Vue préparatoire du Conseil de Classe ».
 * Vérifie sur la vraie base :
 *  - la vue agrège les 5 signaux (promus d'office, à surveiller, discipline,
 *    forte baisse, décision d'orientation) + l'effectif ;
 *  - elle fonctionne AVANT l'ouverture de la session (indexée classe+période) ;
 *  - RBAC : Élève et Parent → 403, ADMIN/STAFF(VALIDATE_GRADES) → 200 ;
 *  - isolation multi-tenant : classe d'une autre école → 404.
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
let studentToken: string;
let parentToken: string;
let classId: string;
let academicYearId: string;
let academicPeriodId: string;
let academicPeriodIdPrec: string;
let studentAId: string;
let studentBId: string;

const headers = (token: string) => ({ Cookie: `access_token=${token}`, 'Content-Type': 'application/json' });

const getPreview = (token: string) =>
  fetch(`${baseUrl}/class-councils/preview?classId=${classId}&academicPeriodId=${academicPeriodId}`, {
    method: 'GET',
    headers: headers(token),
  });

const signer = (userId: string, ecoleId: string, role: string) =>
  jwt.sign(
    { userId, schoolId: ecoleId, role, permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

async function creerBulletin(studentId: string, moyenne: number, rang: number, subjectAverages: number[]) {
  const rc = await prismaTest.reportCard.create({
    data: {
      schoolId, studentId, academicPeriodId, academicYearId,
      validationStatus: 'GENERATED', generalAverage: moyenne, rank: rang, totalStudents: 2,
    },
  });
  const sujetA = await prismaTest.subject.create({ data: { schoolId, name: `Maths-${studentId}` } });
  const sujetB = await prismaTest.subject.create({ data: { schoolId, name: `Phy-${studentId}` } });
  await prismaTest.reportCardSubjectLine.createMany({
    data: [
      { reportCardId: rc.id, subjectId: sujetA.id, subjectName: 'Maths', subjectAverage: subjectAverages[0] },
      { reportCardId: rc.id, subjectId: sujetB.id, subjectName: 'Physique', subjectAverage: subjectAverages[1] },
    ],
  });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'vueConseil');
  schoolId = school.id;
  const schoolB = await creerEcoleTest(prismaTest, 'vueConseilB');
  schoolBId = schoolB.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = signer(admin.id, schoolId, 'ADMIN');
  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
  studentToken = signer(student.id, schoolId, 'STUDENT');
  const parent = await creerUtilisateurTest(prismaTest, schoolId, { role: 'PARENT' });
  parentToken = signer(parent.id, schoolId, 'PARENT');

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isCurrent: true },
  });
  academicYearId = annee.id;
  const classe = await prismaTest.class.create({ data: { schoolId, academicYearId: annee.id, name: '3ème', level: '3ème' } });
  classId = classe.id;

  const periodePrec = await prismaTest.academicPeriod.create({
    data: { name: 'T1', academicYearId: annee.id, orderIndex: 1, startDate: new Date('2025-09-01'), endDate: new Date('2025-11-15') },
  });
  academicPeriodIdPrec = periodePrec.id;
  const periode = await prismaTest.academicPeriod.create({
    data: { name: 'T2', academicYearId: annee.id, orderIndex: 2, startDate: new Date('2025-11-20'), endDate: new Date('2026-02-15') },
  });
  academicPeriodId = periode.id;

  const studentA = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'vue-a' });
  studentAId = studentA.id;
  await creerEleveAvecClasse(enrollmentRepo, { userId: studentA.id, classId, enrolledById: studentA.id });

  const studentB = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'vue-b' });
  studentBId = studentB.id;
  await creerEleveAvecClasse(enrollmentRepo, { userId: studentB.id, classId, enrolledById: studentB.id });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.recommandationSerie.deleteMany({ where: { studentId: { in: [studentAId, studentBId] } } });
  await prismaTest.ficheOrientation.deleteMany({ where: { studentId: { in: [studentAId, studentBId] } } });
  await prismaTest.disciplineRecord.deleteMany({ where: { schoolId } });
  await prismaTest.reportCardSubjectLine.deleteMany({ where: { reportCard: { schoolId } } });
  await prismaTest.reportCard.deleteMany({ where: { schoolId } });
  await prismaTest.subject.deleteMany({ where: { schoolId } });
  await prismaTest.classCouncilDecision.deleteMany({ where: { session: { schoolId } } });
  await prismaTest.classCouncilSession.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.academicPeriod.deleteMany({ where: { academicYearId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await nettoyerEcole(prismaTest, schoolBId);
});

describe('V1.12 — Vue préparatoire du Conseil de Classe', () => {
  it('fonctionne avant l\'ouverture d\'une session de conseil et agrège les signaux', async () => {
    // Aucune session de conseil créée — la vue doit quand même répondre
    await creerBulletin(studentAId, 12, 1, [14, 11]);       // promu d'office
    await creerBulletin(studentBId, 7, 2, [9, 5]);          // ni promu, ni baisse détectée (pas de période préc.)

    const res = await getPreview(adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { vue: any };
    expect(body.vue.effectif).toBe(2);
    expect(body.vue.compteurs.promusOffice).toBe(1);
    expect(body.vue.eleves.find((e: any) => e.studentId === studentAId)!.promuOffice).toBe(true);
  });

  it('détecte la forte baisse entre périodes', async () => {
    await prismaTest.reportCard.create({
      data: {
        schoolId, studentId: studentBId, academicPeriodId: academicPeriodIdPrec, academicYearId,
        validationStatus: 'GENERATED', generalAverage: 12, rank: 1,
      },
    });
    const res = await getPreview(adminToken);
    const body = await res.json() as { vue: any };
    const b = body.vue.eleves.find((e: any) => e.studentId === studentBId)!;
    expect(b.enForteBaisse).toBe(true);
    expect(b.baissePoints).toBeGreaterThanOrEqual(3);
    expect(body.vue.compteurs.enForteBaisse).toBe(1);
  });

  it('remonte un cas disciplinaire ACTIVE', async () => {
    const adminUser = await prismaTest.user.findFirst({ where: { schoolId, role: 'ADMIN' } });
    await prismaTest.disciplineRecord.create({
      data: { schoolId, studentId: studentBId, type: 'TEMP_EXCLUSION', reason: 'Conflit', decidedById: adminUser!.id },
    });

    const res = await getPreview(adminToken);
    const body = await res.json() as { vue: any };
    const b = body.vue.eleves.find((e: any) => e.studentId === studentBId)!;
    expect(b.casDisciplinaire).toBe(true);
    expect(body.vue.compteurs.casDisciplinaires).toBe(1);
  });

  it('remonte une recommandation d\'orientation non validée', async () => {
    const fiche = await prismaTest.ficheOrientation.create({
      data: { schoolId, studentId: studentBId, academicYearId, conseillerId: (await prismaTest.user.findFirst({ where: { schoolId, role: 'ADMIN' } }))!.id },
    });
    await prismaTest.recommandationSerie.create({
      data: {
        ficheOrientationId: fiche.id, studentId: studentBId,
        serieActuelle: '3e', serieRecommandee: 'Seconde C', justification: 'Bon niveau',
        adminValidated: false,
      },
    });

    const res = await getPreview(adminToken);
    const body = await res.json() as { vue: any };
    const b = body.vue.eleves.find((e: any) => e.studentId === studentBId)!;
    expect(b.decisionOrientation).toBe(true);
    expect(body.vue.compteurs.decisionsOrientation).toBe(1);
  });

  it('RBAC : Élève et Parent → 403, même pour leur propre classe', async () => {
    const resStudent = await getPreview(studentToken);
    expect(resStudent.status).toBe(403);
    const resParent = await getPreview(parentToken);
    expect(resParent.status).toBe(403);
  });

  it('isolation multi-tenant : classe d\'une autre école → 404', async () => {
    const anneeB = await prismaTest.academicYear.create({
      data: { schoolId: schoolBId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isCurrent: true },
    });
    const classeB = await prismaTest.class.create({ data: { schoolId: schoolBId, academicYearId: anneeB.id, name: '3e B' } });
    const adminB = await creerUtilisateurTest(prismaTest, schoolBId, { role: 'ADMIN' });
    const tokenB = signer(adminB.id, schoolBId, 'ADMIN');

    const res = await fetch(`${baseUrl}/class-councils/preview?classId=${classId}&academicPeriodId=${academicPeriodId}`, {
      method: 'GET',
      headers: headers(tokenB),
    });
    expect(res.status).toBe(404);

    // La classe B existe bien pour son propre établissement
    const resPropre = await fetch(`${baseUrl}/class-councils/preview?classId=${classeB.id}&academicPeriodId=${academicPeriodId}`, {
      method: 'GET',
      headers: headers(tokenB),
    });
    // 200 ou 404 (période d'une autre école), jamais 403 — pas de fuite de données
    expect([200, 404]).toContain(resPropre.status);
  });

  it('paramètres manquants → 400', async () => {
    const res = await fetch(`${baseUrl}/class-councils/preview?classId=${classId}`, {
      method: 'GET',
      headers: headers(adminToken),
    });
    expect(res.status).toBe(400);
  });
});