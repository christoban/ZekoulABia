/**
 * Test d'intégration — les 4 flux MINESEC cassés par le renommage Enrollment→InscriptionMinesec
 * Prérequis : bun test --env-file .env.test (nécessite TarifMinesecReference seedé pour
 * anneeScolaire "2025-2026" — présent via `bunx prisma db seed`).
 *
 * Ces 4 use cases utilisaient tous `this.prisma.enrollment.*`, devenu invalide après le
 * renommage du modèle (le client Prisma n'a plus de propriété `.enrollment`). Le cast masquait
 * l'erreur au compilateur — seul un vrai appel HTTP de bout en bout la révèle.
 *
 *  1. PrepareExamDossierUseCase   → POST /examens/register
 *  2. GenererPaiementsMinesecUseCase → POST /paiements-minesec/generate/:studentProfileId
 *  3. GetStudentPaymentDashboardUseCase → GET /paiements-minesec/dashboard/student/:studentId
 *  4. GetSchoolPaymentOverviewUseCase → GET /paiements-minesec/dashboard/school
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { creerEleveAvecClasse } from '@application/shared/studentEnrollment';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
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

const ANNEE_SCOLAIRE = '2025-2026';

let server: Server;
let baseUrl: string;
let schoolId: string;
let adminToken: string;
let studentUserId: string;
let studentProfileId: string;

const authHeaders = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const tarifExiste = await prismaTest.tarifMinesecReference.findFirst({ where: { anneeScolaire: ANNEE_SCOLAIRE, typeFrais: 'EXAMEN_BEPC' } });
  if (!tarifExiste) {
    throw new Error(
      `TarifMinesecReference introuvable pour ${ANNEE_SCOLAIRE} dans zekoulabia_test — lancez d'abord : ` +
      'DATABASE_URL doit être défini vers la base de test avant : bunx prisma db seed',
    );
  }

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'minesecPaiements');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: ANNEE_SCOLAIRE, startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isCurrent: true },
  });
  const classe = await prismaTest.class.create({
    data: { schoolId, academicYearId: annee.id, name: '3ème A', level: '3ème' },
  });

  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
  studentUserId = student.id;
  const profile = await creerEleveAvecClasse(enrollmentRepo, {
    userId: student.id, classId: classe.id, enrolledById: student.id,
    extraProfileData: { matricule: 'MAT20250001', matriculeVerifieAt: new Date() },
  });
  studentProfileId = profile.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.examRegistration.deleteMany({ where: { schoolId } });
  await prismaTest.paiementMinesec.deleteMany({ where: { schoolId } });
  await prismaTest.inscriptionMinesec.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { userId: studentUserId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('Régression Enrollment→InscriptionMinesec — 4 flux vérifiés de bout en bout', () => {
  it('1. PrepareExamDossierUseCase (POST /examens/register) crée le dossier ET stampe une InscriptionMinesec', async () => {
    const res = await fetch(`${baseUrl}/examens/register`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ studentUserId, typeExamen: 'BEPC', anneeScolaire: ANNEE_SCOLAIRE }),
    });
    const body = await res.json() as { success: boolean; message?: string; data?: { registrationId: string; status: string } };

    if (!body.success) throw new Error(`Échec inscription examen : ${body.message ?? JSON.stringify(body)}`);
    expect(res.status).toBe(200);
    expect(body.data!.status).toBe('DRAFT');

    const inscription = await prismaTest.inscriptionMinesec.findUnique({
      where: { studentId_schoolId_anneeScolaire: { studentId: studentProfileId, schoolId, anneeScolaire: ANNEE_SCOLAIRE } },
    });
    expect(inscription).not.toBeNull();
    expect(inscription!.status).toBe('ACTIVE');

    const registration = await prismaTest.examRegistration.findUnique({ where: { id: body.data!.registrationId } });
    expect(registration?.enrollmentId).toBe(inscription!.id);
  });

  it('2. GenererPaiementsMinesecUseCase (POST /paiements-minesec/generate/:id) génère les frais et réutilise la même InscriptionMinesec', async () => {
    const res = await fetch(`${baseUrl}/paiements-minesec/generate/${studentProfileId}`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ anneeScolaire: ANNEE_SCOLAIRE }),
    });
    const body = await res.json() as { success: boolean; message?: string; data?: { generated: number; skipped: number; enrollmentCreated: boolean } };

    if (!body.success) throw new Error(`Échec génération paiements : ${body.message ?? JSON.stringify(body)}`);
    expect(res.status).toBe(200);
    // 3ème => SCOLARITE_PREMIER_CYCLE + EXAMEN_BEPC = 2 frais générés
    expect(body.data!.generated).toBe(2);
    // L'InscriptionMinesec créée par le test précédent doit être réutilisée, pas dupliquée
    expect(body.data!.enrollmentCreated).toBe(false);

    const paiements = await prismaTest.paiementMinesec.findMany({ where: { studentId: studentProfileId, anneeScolaire: ANNEE_SCOLAIRE } });
    expect(paiements.length).toBe(2);
    expect(paiements.map(p => p.typeFrais).sort()).toEqual(['EXAMEN_BEPC', 'SCOLARITE_PREMIER_CYCLE']);

    const inscriptions = await prismaTest.inscriptionMinesec.count({ where: { studentId: studentProfileId, schoolId, anneeScolaire: ANNEE_SCOLAIRE } });
    expect(inscriptions).toBe(1);
  });

  it('3. GetStudentPaymentDashboardUseCase (GET /paiements-minesec/dashboard/student/:id) reflète les paiements générés', async () => {
    const res = await fetch(`${baseUrl}/paiements-minesec/dashboard/student/${studentUserId}`, { headers: authHeaders() });
    const body = await res.json() as { success: boolean; message?: string; data?: { paiementsMinesec: unknown[]; totaux: { totalAttendu: number } } };

    if (!body.success) throw new Error(`Échec dashboard élève : ${body.message ?? JSON.stringify(body)}`);
    expect(res.status).toBe(200);
    expect(body.data!.paiementsMinesec.length).toBe(2);
    // 7500 (SCOLARITE_PREMIER_CYCLE) + 7000 (EXAMEN_BEPC) = 14500
    expect(body.data!.totaux.totalAttendu).toBe(14500);
  });

  it('4. GetSchoolPaymentOverviewUseCase (GET /paiements-minesec/dashboard/school) compte bien via InscriptionMinesec', async () => {
    const res = await fetch(`${baseUrl}/paiements-minesec/dashboard/school?anneeScolaire=${ANNEE_SCOLAIRE}`, { headers: authHeaders() });
    const body = await res.json() as { success: boolean; message?: string; data?: { totalEleves: number; minesec: { status: string; _count: { _all: number } }[] } };

    if (!body.success) throw new Error(`Échec aperçu école : ${body.message ?? JSON.stringify(body)}`);
    expect(res.status).toBe(200);
    expect(body.data!.totalEleves).toBe(1);
    const totalPaiements = body.data!.minesec.reduce((s, g) => s + g._count._all, 0);
    expect(totalPaiements).toBe(2);
  });
});
