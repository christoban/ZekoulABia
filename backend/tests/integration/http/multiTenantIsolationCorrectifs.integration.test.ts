/**
 * Test d'intégration — Isolation multi-tenant, volet « correctifs de la cartographie »
 * Prérequis : bun test --env-file .env.test
 *
 * Verrouille les 7 correctifs issus de CARTOGRAPHIE_MULTITENANT.md qui n'étaient corrects qu'à la
 * lecture du code, faute de double InMemory ou de tout test sur la route concernée :
 *
 *   2.3  PATCH /orientation/entretiens/:id
 *   2.3  PATCH /orientation/recommandations/:id/valider
 *   2.4  PATCH /examens/:id/set-candidate-number
 *   2.4  PATCH /examens/:id/result
 *   2.5  PATCH /academic-years/periods/:id/set-current   (non couvrable en unitaire)
 *   2.6  POST  /onboarding/execute
 *   2.7  GET   /matricules/import-jobs/:id
 *
 * Le point clé de méthode : l'appelant est un ADMIN parfaitement légitime dans SON école. Un test
 * qui utiliserait un utilisateur sans le bon rôle passerait au vert sur les 9 défauts d'origine
 * sans rien prouver — il mesurerait le middleware, pas l'isolation.
 *
 * Chaque cas vérifie DEUX choses : le code HTTP de refus, et que la donnée de l'école B est restée
 * intacte en base. Le second point est le seul qui distingue « refusé » de « écrit puis refusé ».
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';
import { creerEleveAvecClasse } from '@application/shared/studentEnrollment';

const enrollmentRepo = new PrismaEnrollmentRepository(prismaTest);

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET non défini — requis dans .env.test pour ce test.');
}

let server: Server;
let baseUrl: string;

let schoolA: { id: string };
let schoolB: { id: string };
let adminA: { id: string };
let studentUserB: { id: string };
let conseillerB: { id: string };
let academicYearB: { id: string };
let classB: { id: string };
let studentProfileB: { id: string };
let academicPeriodB: { id: string };
let examRegistrationB: { id: string };
let importJobB: { id: string };
let ficheB: { id: string };
let entretienB: { id: string };
let recommandationB: { id: string };
let tokenA: string;

const signAccessToken = (payload: { userId: string; schoolId: string; role: string }) =>
  jwt.sign({ ...payload, permissions: [], tokenType: 'access' }, process.env.JWT_SECRET!);

const authHeaders = (token: string) => ({
  Cookie: `access_token=${token}`,
  'Content-Type': 'application/json',
});

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);

  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  schoolA = await creerEcoleTest(prismaTest, 'corrA');
  schoolB = await creerEcoleTest(prismaTest, 'corrB');
  adminA = await creerUtilisateurTest(prismaTest, schoolA.id, { role: 'ADMIN' });

  academicYearB = await prismaTest.academicYear.create({
    data: { schoolId: schoolB.id, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30') },
  });
  classB = await prismaTest.class.create({
    data: { schoolId: schoolB.id, name: '3ème B', academicYearId: academicYearB.id },
  });

  studentUserB = await creerUtilisateurTest(prismaTest, schoolB.id, { role: 'STUDENT' });
  studentProfileB = await creerEleveAvecClasse(enrollmentRepo, { userId: studentUserB.id, classId: classB.id, enrolledById: studentUserB.id });
  conseillerB = await creerUtilisateurTest(prismaTest, schoolB.id, { role: 'STAFF' });

  // 2.5 — AcademicPeriod ne porte PAS de schoolId : sa tenancy vient de son AcademicYear. C'est
  // précisément pour ça que ce cas n'est pas couvrable par un double InMemory.
  academicPeriodB = await prismaTest.academicPeriod.create({
    data: {
      academicYearId: academicYearB.id, name: 'Trimestre 1', orderIndex: 1,
      startDate: new Date('2025-09-01'), endDate: new Date('2025-12-20'), isCurrent: false,
    },
  });

  // 2.4
  examRegistrationB = await prismaTest.examRegistration.create({
    data: {
      studentId: studentProfileB.id, enrollmentId: 'enrol-B', schoolId: schoolB.id,
      anneeScolaire: '2025-2026', typeExamen: 'BEPC', session: 1,
      matriculeNational: 'MAT-B-001', status: 'DRAFT',
    },
  });

  // 2.7
  importJobB = await prismaTest.matriculeImportJob.create({
    data: { schoolId: schoolB.id, uploadedBy: conseillerB.id, fileName: 'eleves-B.csv', status: 'COMPLETED' },
  });

  // 2.3 — EntretienOrientation ne porte pas de schoolId non plus : tenancy via sa FicheOrientation.
  ficheB = await prismaTest.ficheOrientation.create({
    data: {
      studentId: studentUserB.id, schoolId: schoolB.id,
      academicYearId: academicYearB.id, conseillerId: conseillerB.id,
    },
  });
  entretienB = await prismaTest.entretienOrientation.create({
    data: {
      ficheOrientationId: ficheB.id, date: new Date('2025-10-01'),
      type: 'INDIVIDUEL', motif: 'ORIENTATION_GENERALE', notes: 'Notes originales école B',
    },
  });
  recommandationB = await prismaTest.recommandationSerie.create({
    data: {
      ficheOrientationId: ficheB.id, studentId: studentUserB.id,
      serieActuelle: '3ème', serieRecommandee: 'C',
      justification: 'Bon niveau scientifique', adminValidated: false, status: 'PROPOSEE',
    },
  });

  tokenA = signAccessToken({ userId: adminA.id, schoolId: schoolA.id, role: 'ADMIN' });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.recommandationSerie.deleteMany({ where: { ficheOrientationId: ficheB.id } });
  await prismaTest.entretienOrientation.deleteMany({ where: { ficheOrientationId: ficheB.id } });
  await prismaTest.ficheOrientation.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.matriculeImportJob.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.examRegistration.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.academicPeriod.deleteMany({ where: { academicYear: { schoolId: schoolB.id } } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.studentProfile.deleteMany({ where: { userId: studentUserB.id } });
  await prismaTest.class.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.user.deleteMany({ where: { schoolId: schoolB.id } });
  await prismaTest.user.deleteMany({ where: { schoolId: schoolA.id } });
  await nettoyerEcole(prismaTest, schoolA.id);
  await nettoyerEcole(prismaTest, schoolB.id);
  await prismaTest.$disconnect();
});

describe('Isolation multi-tenant — correctifs de la cartographie (admin légitime de A vs données de B)', () => {
  it("2.3 — modifier un entretien d'orientation de l'école B est refusé", async () => {
    const res = await fetch(`${baseUrl}/orientation/entretiens/${entretienB.id}`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
      body: JSON.stringify({ notes: 'Écrasé par A' }),
    });
    expect(res.status).toBe(404);

    const intact = await prismaTest.entretienOrientation.findUnique({ where: { id: entretienB.id } });
    expect(intact?.notes).toBe('Notes originales école B');
  });

  it("2.3 — valider une recommandation de série de l'école B est refusé", async () => {
    const res = await fetch(`${baseUrl}/orientation/recommandations/${recommandationB.id}/valider`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
    });
    expect(res.status).toBe(404);

    const intacte = await prismaTest.recommandationSerie.findUnique({ where: { id: recommandationB.id } });
    expect(intacte?.adminValidated).toBe(false);
    expect(intacte?.status).toBe('PROPOSEE');
  });

  it("2.4 — écrire le numéro de candidat d'un examen de l'école B est refusé", async () => {
    const res = await fetch(`${baseUrl}/examens/${examRegistrationB.id}/set-candidate-number`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
      body: JSON.stringify({ numeroCandidatExamen: 'PIRATE-001' }),
    });
    expect(res.status).toBe(404);

    const intacte = await prismaTest.examRegistration.findUnique({ where: { id: examRegistrationB.id } });
    expect(intacte?.numeroCandidatExamen).toBeNull();
    expect(intacte?.status).toBe('DRAFT');
  });

  it("2.4 — écrire le résultat d'un examen de l'école B est refusé", async () => {
    const res = await fetch(`${baseUrl}/examens/${examRegistrationB.id}/result`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
      body: JSON.stringify({ resultatStatus: 'ADMIS', resultatMention: 'BIEN' }),
    });
    expect(res.status).toBe(404);

    const intacte = await prismaTest.examRegistration.findUnique({ where: { id: examRegistrationB.id } });
    expect(intacte?.resultatStatus).toBeNull();
    expect(intacte?.status).toBe('DRAFT');
  });

  it("2.5 — définir la période courante de l'école B est refusé", async () => {
    const res = await fetch(`${baseUrl}/academic-years/periods/${academicPeriodB.id}/set-current`, {
      method: 'PATCH',
      headers: authHeaders(tokenA),
    });
    expect(res.status).not.toBe(200);

    const intacte = await prismaTest.academicPeriod.findUnique({ where: { id: academicPeriodB.id } });
    expect(intacte?.isCurrent).toBe(false);
  });

  it("2.6 — activer l'établissement de l'école B est refusé", async () => {
    const statutAvant = (await prismaTest.school.findUnique({ where: { id: schoolB.id } }))?.status;

    const res = await fetch(`${baseUrl}/onboarding/execute`, {
      method: 'POST',
      headers: authHeaders(tokenA),
      body: JSON.stringify({
        schoolId: schoolB.id,
        template: 'LYCEE_FR',
        cycles: ['PREMIER_CYCLE'],
      }),
    });
    expect(res.status).toBe(403);

    const apres = await prismaTest.school.findUnique({ where: { id: schoolB.id } });
    expect(apres?.status).toBe(statutAvant!);
  });

  it("2.7 — aucun job d'import de l'école B ne fuite sur /import-jobs/:param", async () => {
    // Ce test a révélé que la route est MASQUÉE : `/import-jobs/:schoolId` (listJobs) est déclarée
    // avant `/import-jobs/:id` (getJob) dans matricule.routes.ts, donc Express prend toujours la
    // première et `getJob` est inatteignable. Le défaut 2.7 n'était donc pas exploitable.
    // listJobs ignore le paramètre d'URL et lit `req.user.schoolId` : la réponse est 200, mais elle
    // ne contient que les jobs de l'appelant. C'est l'absence de fuite qui est vérifiée ici, pas un
    // code de refus — assert sur un 404 reviendrait à tester du code mort.
    const res = await fetch(`${baseUrl}/matricules/import-jobs/${importJobB.id}`, {
      headers: authHeaders(tokenA),
    });
    const body = await res.text();
    expect(body).not.toContain('eleves-B.csv');
    expect(body).not.toContain(importJobB.id);
  });
});
