/**
 * Test d'intégration — Activation de bout en bout via ConfigurerEtablissementUseCase
 * (POST /api/v2/onboarding/execute)
 *
 * Prérequis : bun test --env-file .env.test
 *
 * Vérifie qu'une activation réelle via la route conversationnelle crée correctement l'année
 * scolaire, les périodes, séquences, classes et matières. Point de vigilance historique :
 * chaque classe créée doit porter l'academicYearId de l'année scolaire fraîchement créée dans
 * la même transaction — pas une valeur par défaut, pas une omission silencieuse.
 *
 * Nécessite le référentiel curriculaire national seedé (CycleCoefficient, SchoolTemplate, etc. —
 * `bunx prisma db seed` contre zekoulabia_test) : sans lui, LYCEE_FR n'a pas de coefficients de
 * matières et l'activation échoue avant même d'atteindre la création des classes.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET non défini — requis dans .env.test pour ce test.');
}

let server: Server;
let baseUrl: string;
let schoolId: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const templateExiste = await prismaTest.schoolTemplate.findUnique({ where: { code: 'LYCEE_FR' } });
  if (!templateExiste) {
    throw new Error(
      "SchoolTemplate 'LYCEE_FR' introuvable dans zekoulabia_test — lancez d'abord : " +
      'DATABASE_URL doit être défini vers la base de test avant : bunx prisma db seed',
    );
  }

  const school = await prismaTest.school.create({
    data: {
      name: 'Lycée Test Activation',
      subdomain: `test-activation-${Date.now()}`,
      status: 'APPROVED',
      subsystem: 'FRANCOPHONE',
      templateCode: 'LYCEE_FR',
      onboardingConfig: {},
    },
  });
  schoolId = school.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.subjectCoefficient.deleteMany({ where: { schoolId } });
  await prismaTest.classSubjectOverride.deleteMany({ where: { schoolId } });
  await prismaTest.subject.deleteMany({ where: { schoolId } });
  await prismaTest.gradeFormula.deleteMany({ where: { schoolId } });
  await prismaTest.mentionRule.deleteMany({ where: { schoolId } });
  await prismaTest.schoolConfig.deleteMany({ where: { schoolId } });
  await prismaTest.schoolSettings.deleteMany({ where: { schoolId } });
  await prismaTest.academicSequence.deleteMany({ where: { schoolId } });
  await prismaTest.academicPeriod.deleteMany({ where: { academicYear: { schoolId } } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe("ConfigurerEtablissementUseCase — activation de bout en bout (POST /onboarding/execute)", () => {
  it("stampe academicYearId sur chaque classe créée, sans cast de contournement ni valeur par défaut", async () => {
    const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
    const token = jwt.sign(
      { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
      process.env.JWT_SECRET!,
    );

    const state = {
      schoolId,
      template: 'LYCEE_FR',
      subSystem: 'FRANCOPHONE',
      cycles: ['PREMIER_CYCLE'],
      classesPerLevel: { '6ème': 2 },
      conventionNommage: 'LETTRES',
      academicYearStart: '2025-09-01',
      academicYearEnd: '2026-06-30',
      adminUserId: admin.id,
    };

    const res = await fetch(`${baseUrl}/onboarding/execute`, {
      method: 'POST',
      headers: { Cookie: `access_token=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    const body = await res.json() as { success: boolean; message?: string; data?: { classCount: number; academicYear: string } };

    // Si l'activation échoue, afficher la vraie raison plutôt qu'un simple "status 200 attendu" —
    // ce use case a de nombreux chemins possibles d'échec (référentiel manquant, config invalide).
    if (!body.success) {
      throw new Error(`Activation échouée : ${body.message ?? JSON.stringify(body)}`);
    }
    expect(res.status).toBe(200);
    expect(body.data!.classCount).toBeGreaterThan(0);

    const anneeScolaire = await prismaTest.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
    expect(anneeScolaire).not.toBeNull();

    const classes = await prismaTest.class.findMany({ where: { schoolId } });
    expect(classes.length).toBe(body.data!.classCount);
    expect(classes.length).toBeGreaterThan(0);
    for (const c of classes) {
      expect(c.academicYearId).toBe(anneeScolaire!.id);
      expect(c.status).toBe('ACTIVE');
    }

    const ecoleActive = await prismaTest.school.findUnique({ where: { id: schoolId } });
    expect(ecoleActive?.status).toBe('ACTIVE');
  });
});
