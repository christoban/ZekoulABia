/**
 * Test d'intégration — V1.11 « Workflow de publication des frais ».
 * Vérifie sur la vraie base :
 *  - un plan DRAFT/PENDING_VALIDATION/APPROVED ne peut pas générer de facture ;
 *  - après publication (PUBLISHED), la facturation passe ;
 *  - les transitions invalides → 409 TRANSITION_STATUT_INVALIDE ;
 *  - isolation multi-tenant : l'admin d'une école B ne peut pas changer le statut
 *    d'un plan de l'école A.
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
let schoolBId: string;
let adminToken: string;
let adminBToken: string;
let studentId: string;

const authHeaders = (token: string) => ({ Cookie: `access_token=${token}`, 'Content-Type': 'application/json' });

const changerStatut = async (planId: string, statutCible: string, token = adminToken) => {
  const res = await fetch(`${baseUrl}/finance/fee-plans/${planId}/status`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ statutCible }),
  });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
};

const genererFacture = async (feePlanId: string, token = adminToken) => {
  const res = await fetch(`${baseUrl}/finance/invoices`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ studentId, feePlanId }),
  });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
};

const creerPlan = async (status: 'DRAFT' | 'PENDING_VALIDATION' | 'APPROVED' | 'PUBLISHED', ecoleId: string) => {
  const plan = await prismaTest.feePlan.create({
    data: {
      schoolId: ecoleId,
      name: `Plan ${status}`,
      amount: 5000,
      feeType: 'EXAM',
      status,
    },
  });
  return plan;
};

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'planFraisWorkflow');
  schoolId = school.id;
  const schoolB = await creerEcoleTest(prismaTest, 'planFraisWorkflowB');
  schoolBId = schoolB.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );
  const adminB = await creerUtilisateurTest(prismaTest, schoolBId, { role: 'ADMIN' });
  adminBToken = jwt.sign(
    { userId: adminB.id, schoolId: schoolBId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
  studentId = student.id;
});

afterAll(async () => {
  await nettoyerEcole(prismaTest, schoolId);
  await nettoyerEcole(prismaTest, schoolBId);
  server.close();
});

describe('V1.11 — Workflow de publication des frais', () => {
  it('un plan DRAFT ne peut pas générer de facture', async () => {
    const plan = await creerPlan('DRAFT', schoolId);
    const res = await genererFacture(plan.id);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PLAN_NON_PUBLIE');
    expect((res.body.message as string)).toContain("n'est pas publié");
  });

  it('un plan APPROVED ne peut pas encore générer de facture', async () => {
    const plan = await creerPlan('APPROVED', schoolId);
    const res = await genererFacture(plan.id);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe('PLAN_NON_PUBLIE');
    expect((res.body.message as string)).toContain("n'est pas publié");
  });

  it('le workflow complet DRAFT → PENDING_VALIDATION → APPROVED → PUBLISHED débloque la facturation', async () => {
    const plan = await creerPlan('DRAFT', schoolId);

    // Transition invalide d'abord
    const invalide = await changerStatut(plan.id, 'PUBLISHED');
    expect(invalide.status).toBe(409);
    expect(invalide.body.code).toBe('TRANSITION_STATUT_INVALIDE');

    // Chemin valide étape par étape
    const s1 = await changerStatut(plan.id, 'PENDING_VALIDATION');
    expect(s1.status).toBe(200);
    expect((s1.body.data as Record<string, unknown>).status).toBe('PENDING_VALIDATION');

    const s2 = await changerStatut(plan.id, 'APPROVED');
    expect(s2.status).toBe(200);

    const s3 = await changerStatut(plan.id, 'PUBLISHED');
    expect(s3.status).toBe(200);
    expect((s3.body.data as Record<string, unknown>).status).toBe('PUBLISHED');

    // Désormais facturable
    const facture = await genererFacture(plan.id);
    expect(facture.status).toBe(201);
  });

  it('retour arrière (PUBLISHED → DRAFT) rejeté avec 409', async () => {
    const plan = await creerPlan('PUBLISHED', schoolId);
    const res = await changerStatut(plan.id, 'DRAFT');
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('TRANSITION_STATUT_INVALIDE');
  });

  it('isolation multi-tenant : un ADMIN de l\'école B ne peut pas modifier un plan de l\'école A', async () => {
    const plan = await creerPlan('DRAFT', schoolId);
    const res = await changerStatut(plan.id, 'PENDING_VALIDATION', adminBToken);
    expect(res.status).toBe(403);
    expect((res.body.message as string)).toContain("n'appartient pas");
  });

  it('statutCible manquant → 400', async () => {
    const plan = await creerPlan('DRAFT', schoolId);
    const res = await fetch(`${baseUrl}/finance/fee-plans/${plan.id}/status`, {
      method: 'PATCH',
      headers: authHeaders(adminToken),
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('plan introuvable → 404', async () => {
    const res = await changerStatut('inexistant', 'PENDING_VALIDATION');
    expect(res.status).toBe(404);
  });
});