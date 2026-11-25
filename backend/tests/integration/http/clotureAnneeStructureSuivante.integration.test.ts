/**
 * Test d'intégration — workflow complet de clôture d'année avec proposition de structure
 * (design tranché : jamais de clonage silencieux) :
 *   1. POST /academic-years/:id/propose-next-structure — clone 1:1 en DRAFT + écrit les
 *      mappings ClassPromotion.
 *   2. L'admin revoit et renomme une classe DRAFT via l'endpoint classes existant (PUT /classes/:id).
 *   3. POST /academic-years/:id/validate-structure — bascule les DRAFT en ACTIVE.
 *   4. POST /academic-years/:id/close (déjà existant) — promeut réellement l'élève vers la
 *      classe validée, en utilisant le mapping écrit à l'étape 1.
 *
 * Aucune note n'est créée pour la classe testée : VerifierPrerequisClotureUseCase n'exige un
 * conseil verrouillé / des bulletins que pour les classes ayant au moins une note sur l'année
 * (voir PrismaAnneeAcademiqueRepository) — une décision de conseil suffit donc pour piloter la
 * promotion, sans avoir à simuler tout le cycle notes→bulletins→conseil verrouillé.
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
let adminToken: string;
let adminUserId: string;
let anneeActuelleId: string;
let anneeSuivanteId: string;
let classeSourceId: string;
let studentUserId: string;
let studentProfileId: string;

const authHeaders = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'clotureStructure');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminUserId = admin.id;
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const anneeActuelle = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  anneeActuelleId = anneeActuelle.id;
  const periode = await prismaTest.academicPeriod.create({
    data: { academicYearId: anneeActuelleId, name: 'Trimestre 3', type: 'TRIMESTER', orderIndex: 3, startDate: new Date('2026-04-01'), endDate: new Date('2026-07-31'), isCurrent: true },
  });

  const anneeSuivante = await prismaTest.academicYear.create({
    data: { schoolId, name: '2026-2027', startDate: new Date('2026-09-01'), endDate: new Date('2027-07-31'), isCurrent: false, status: 'ACTIVE' },
  });
  anneeSuivanteId = anneeSuivante.id;

  const classe = await prismaTest.class.create({
    data: { schoolId, academicYearId: anneeActuelleId, name: '3e A', level: '3e', capacity: 40, status: 'ACTIVE' },
  });
  classeSourceId = classe.id;

  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'cloture-structure' });
  studentUserId = student.id;
  const profile = await creerEleveAvecClasse(enrollmentRepo, { userId: student.id, classId: classeSourceId, enrolledById: student.id });
  studentProfileId = profile.id;

  // Décision de conseil PASS — pilote la promotion à la clôture. Aucune note créée pour cette
  // classe (voir commentaire d'en-tête) : les 3 prérequis de clôture passent donc naturellement.
  const session = await prismaTest.classCouncilSession.create({
    data: { schoolId, classId: classeSourceId, academicPeriodId: periode.id, presidedById: adminUserId, status: 'LOCKED' },
  });
  await prismaTest.classCouncilDecision.create({
    data: { sessionId: session.id, studentId: studentUserId, decision: 'PASS' },
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.aIActionAuditLog.deleteMany({ where: { schoolId } });
  await prismaTest.studentPromotion.deleteMany({ where: { schoolId } });
  await prismaTest.classPromotion.deleteMany({ where: { schoolId } });
  await prismaTest.classCouncilDecision.deleteMany({ where: { session: { schoolId } } });
  await prismaTest.classCouncilSession.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicPeriod.deleteMany({ where: { academicYearId: anneeActuelleId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

let classeDraftId: string;

describe('Clôture d\'année — proposer/renommer/valider structure puis clôturer (bout en bout)', () => {
  it("POST /academic-years/:id/propose-next-structure clone la classe en DRAFT et écrit le mapping ClassPromotion", async () => {
    const res = await fetch(`${baseUrl}/academic-years/${anneeActuelleId}/propose-next-structure`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ anneeSuivanteId }),
    });
    const body = await res.json() as { success: boolean; message?: string; data?: { classesProposees: { classeActuelleId: string; classeProposeeId: string; classeProposeeNom: string }[] } };
    if (!body.success) throw new Error(`Échec proposition : ${body.message ?? JSON.stringify(body)}`);
    expect(res.status).toBe(201);
    expect(body.data!.classesProposees).toHaveLength(1);
    expect(body.data!.classesProposees[0].classeActuelleId).toBe(classeSourceId);
    classeDraftId = body.data!.classesProposees[0].classeProposeeId;

    const draft = await prismaTest.class.findUnique({ where: { id: classeDraftId } });
    expect(draft?.status).toBe('DRAFT');
    expect(draft?.academicYearId).toBe(anneeSuivanteId);
    expect(draft?.name).toBe('3e A');

    const mapping = await prismaTest.classPromotion.findFirst({ where: { schoolId, fromClassId: classeSourceId } });
    expect(mapping?.toClassId).toBe(classeDraftId);
    expect(mapping?.academicYearId).toBe(anneeActuelleId);
  });

  it("l'admin renomme la classe DRAFT via l'endpoint classes existant (revue avant validation)", async () => {
    const res = await fetch(`${baseUrl}/classes/${classeDraftId}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ name: '2nde A', level: '2nde' }),
    });
    const body = await res.json() as { success: boolean; message?: string };
    if (!body.success) throw new Error(`Échec renommage : ${body.message ?? JSON.stringify(body)}`);
    expect(res.status).toBe(200);

    const draft = await prismaTest.class.findUnique({ where: { id: classeDraftId } });
    expect(draft?.name).toBe('2nde A');
    expect(draft?.status).toBe('DRAFT');

    // Le mapping ClassPromotion référence l'id de la classe, pas son nom — reste valide.
    const mapping = await prismaTest.classPromotion.findFirst({ where: { schoolId, fromClassId: classeSourceId } });
    expect(mapping?.toClassId).toBe(classeDraftId);
  });

  it("POST /academic-years/:id/validate-structure bascule la classe DRAFT en ACTIVE", async () => {
    const res = await fetch(`${baseUrl}/academic-years/${anneeSuivanteId}/validate-structure`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const body = await res.json() as { success: boolean; message?: string; data?: { classesActivees: number } };
    if (!body.success) throw new Error(`Échec validation : ${body.message ?? JSON.stringify(body)}`);
    expect(res.status).toBe(200);
    expect(body.data!.classesActivees).toBe(1);

    const classe = await prismaTest.class.findUnique({ where: { id: classeDraftId } });
    expect(classe?.status).toBe('ACTIVE');
  });

  it("POST /academic-years/:id/close clôture l'année en cours et promeut réellement l'élève vers la classe validée (renommée)", async () => {
    const res = await fetch(`${baseUrl}/academic-years/${anneeActuelleId}/close`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({}),
    });
    const body = await res.json() as { success: boolean; message?: string; data?: { elevesPromus: number; elevesNonTraites: number; avertissements: string[] } };
    if (!body.success) throw new Error(`Échec clôture : ${body.message ?? JSON.stringify(body)}`);
    expect(res.status).toBe(200);
    expect(body.data!.elevesPromus).toBe(1);
    expect(body.data!.elevesNonTraites).toBe(0);
    expect(body.data!.avertissements).toEqual([]);

    const anneeActuelle = await prismaTest.academicYear.findUnique({ where: { id: anneeActuelleId } });
    expect(anneeActuelle?.status).toBe('ARCHIVED');

    const enrollment = await prismaTest.enrollment.findFirst({
      where: { studentId: studentProfileId, status: 'ACTIVE', academicYearId: anneeSuivanteId },
    });
    expect(enrollment?.classId).toBe(classeDraftId);
  });
});
