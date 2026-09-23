/**
 * Test d'intégration — Mapping des paramètres d'admission Phase 2
 * Vérifie qu'après un POST /api/v2/onboarding/execute, les 5 champs collectés
 * par ConversationalOnboarding sont bien persistés dans :
 *  - School.adminGereInscriptions
 *  - SchoolOnboardingSettings (directAdmissionWithoutExam, capacityBufferPercent,
 *    selfServiceEnabled, defaultRecipient)
 *
 * Prérequis : bun test --env-file .env.test
 * Nécessite le référentiel seedé (LYCEE_FR).
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
      'DATABASE_URL="postgresql://postgres:123456@localhost:5432/zekoulabia_test?schema=public" bunx prisma db seed',
    );
  }

  const school = await prismaTest.school.create({
    data: {
      name: 'Lycée Test Admission Phase 2',
      subdomain: `test-admission-${Date.now()}`,
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
  await prismaTest.schoolOnboardingSettings.deleteMany({ where: { schoolId } });
  await prismaTest.academicSequence.deleteMany({ where: { schoolId } });
  await prismaTest.academicPeriod.deleteMany({ where: { academicYear: { schoolId } } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await prismaTest.activitiesLog.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('ConfigurerEtablissementUseCase — persistance des admissions Phase 2', () => {
  it('persiste les 5 champs dans School et SchoolOnboardingSettings après /onboarding/execute', async () => {
    const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
    const token = jwt.sign(
      { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
      process.env.JWT_SECRET!,
    );

    const state = {
      schoolId,
      schoolName: 'Lycée Test Admission Phase 2',
      template: 'LYCEE_FR',
      subSystem: 'FRANCOPHONE',
      cycles: ['PREMIER_CYCLE'],
      classesPerLevel: { '6ème': 1 },
      conventionNommage: 'LETTRES',
      academicYearStart: '2025-09-01',
      academicYearEnd: '2026-06-30',
      periodsCount: 3,
      sequencesPerPeriod: 2,
      // Valeurs Phase 2 à vérifier
      adminGereInscriptions: true,
      directAdmissionWithoutExam: true,
      capacityBufferPercent: 15,
      selfServiceEnabled: true,
      defaultRecipient: 'PARENT',
    };

    const res = await fetch(`${baseUrl}/onboarding/execute`, {
      method: 'POST',
      headers: { Cookie: `access_token=${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    });
    const body = await res.json() as { success: boolean; message?: string; data?: { classCount: number } };

    if (!body.success) {
      throw new Error(`Activation échouée : ${body.message ?? JSON.stringify(body)}`);
    }
    expect(res.status).toBe(200);
    expect(body.data!.classCount).toBeGreaterThan(0);

    const school = await prismaTest.school.findUnique({ where: { id: schoolId } });
    expect(school).not.toBeNull();
    expect(school!.adminGereInscriptions).toBe(true);

    const settings = await prismaTest.schoolOnboardingSettings.findUnique({ where: { schoolId } });
    expect(settings).not.toBeNull();
    expect(settings!.directAdmissionWithoutExam).toBe(true);
    expect(settings!.capacityBufferPercent).toBe(15);
    expect(settings!.selfServiceEnabled).toBe(true);
    expect(settings!.defaultRecipient).toBe('PARENT');
  });
});
