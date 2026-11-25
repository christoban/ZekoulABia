/**
 * Test d'intégration — Assessment routes
 *
 * Vérifie que les 4 endpoints montés sous /api/v2/assessments sont atteignables
 * et répondent correctement (même une erreur de validation propre prouve le bon montage).
 * Prérequis : bun test --env-file .env.test
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
let subjectId: string;
let classId: string;

const authHeaders = () => ({
  Cookie: `access_token=${adminToken}`,
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

  const school = await creerEcoleTest(prismaTest, 'assessmentRoutes');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: 'Année-Assessment', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isCurrent: true },
  });
  academicYearId = annee.id;

  // Créer des vrais Subject et Class pour les tests FK
  const subject = await prismaTest.subject.create({
    data: { schoolId, name: 'Maths Test', coefficient: 2 },
  });
  subjectId = subject.id;

  const classe = await prismaTest.class.create({
    data: { schoolId, academicYearId, name: '6e Assessment', level: '6e', capacity: 40, status: 'ACTIVE' },
  });
  classId = classe.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.assessmentParticipation.deleteMany({ where: { schoolId } });
  await prismaTest.harmonizedAssessmentSession.deleteMany({ where: { schoolId } });
  await prismaTest.assessmentScope.deleteMany({ where: { schoolId } });
  await prismaTest.grade.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('Assessment routes — montées sous /api/v2/assessments', () => {
  it('POST /scopes → 201 quand les champs requis sont fournis', async () => {
    const res = await fetch(`${baseUrl}/assessments/scopes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        academicYearId,
        name: 'Test Scope',
        sequenceType: 'DS',
        subjectIds: [],
        classIds: [],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { scopeId: string } };
    expect(body.success).toBe(true);
    expect(body.data.scopeId).toBeDefined();
  });

  it('POST /sessions → 201 quand scopeId valide', async () => {
    // Créer d'abord un scope
    const scopeRes = await fetch(`${baseUrl}/assessments/scopes`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ academicYearId, name: 'Sess Scope', sequenceType: 'DS', subjectIds: [], classIds: [] }),
    });
    const { data: { scopeId } } = await scopeRes.json() as { data: { scopeId: string } };

    const res = await fetch(`${baseUrl}/assessments/sessions`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        assessmentScopeId: scopeId,
        subjectId,
        classId,
        scheduledDate: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { sessionId: string } };
    expect(body.success).toBe(true);
    expect(body.data.sessionId).toBeDefined();
  });

  it('POST /participations → 201 avec status PRESENT', async () => {
    // Créer scope + session
    const scopeRes = await fetch(`${baseUrl}/assessments/scopes`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ academicYearId, name: 'Part Scope', sequenceType: 'DS', subjectIds: [], classIds: [] }),
    });
    const { data: { scopeId } } = await scopeRes.json() as { data: { scopeId: string } };
    const sessionRes = await fetch(`${baseUrl}/assessments/sessions`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ assessmentScopeId: scopeId, subjectId, classId, scheduledDate: new Date().toISOString() }),
    });
    const { data: { sessionId } } = await sessionRes.json() as { data: { sessionId: string } };

    const adminUser = await prismaTest.user.findFirst({ where: { schoolId, role: 'ADMIN' } });
    const res = await fetch(`${baseUrl}/assessments/participations`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ sessionId, studentId: adminUser!.id, status: 'PRESENT' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { participationId: string } };
    expect(body.success).toBe(true);
  });

  it('POST /participations/batch → 201 avec plusieurs participations', async () => {
    // Créer scope + session
    const scopeRes = await fetch(`${baseUrl}/assessments/scopes`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ academicYearId, name: 'Batch Scope', sequenceType: 'DS', subjectIds: [], classIds: [] }),
    });
    const { data: { scopeId } } = await scopeRes.json() as { data: { scopeId: string } };
    const sessionRes = await fetch(`${baseUrl}/assessments/sessions`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ assessmentScopeId: scopeId, subjectId, classId, scheduledDate: new Date().toISOString() }),
    });
    const { data: { sessionId } } = await sessionRes.json() as { data: { sessionId: string } };

    const adminUser = await prismaTest.user.findFirst({ where: { schoolId, role: 'ADMIN' } });
    const res = await fetch(`${baseUrl}/assessments/participations/batch`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({
        sessionId,
        participations: [
          { studentId: adminUser!.id, status: 'ABSENT' },
        ],
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { enregistrees: number } };
    expect(body.success).toBe(true);
    expect(body.data.enregistrees).toBe(1);
  });

  it('POST /scopes sans auth → 401', async () => {
    const res = await fetch(`${baseUrl}/assessments/scopes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ academicYearId, name: 'test', sequenceType: 'DS', subjectIds: [], classIds: [] }),
    });
    expect(res.status).toBe(401);
  });
});
