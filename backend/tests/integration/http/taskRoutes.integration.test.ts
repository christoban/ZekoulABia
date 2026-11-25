/**
 * Test d'intégration — Task routes (/api/v2/tasks)
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
let staffId: string;
let adminUserId: string;

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

  const school = await creerEcoleTest(prismaTest, 'taskRoutes');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminUserId = admin.id;
  const staff = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STAFF' });
  staffId = staff.id;

  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.task.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('Task routes — montées sous /api/v2/tasks', () => {
  it('POST / → 201 création de tâche', async () => {
    const res = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        title: 'Lister les élèves sous 10',
        description: 'Pour vendredi',
        assignedToId: staffId,
        dueDate: new Date().toISOString(),
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { success: boolean; data: { taskId: string } };
    expect(body.success).toBe(true);
    expect(body.data.taskId).toBeDefined();
  });

  it('GET / → 200 liste des tâches de lécole', async () => {
    const res = await fetch(`${baseUrl}/tasks`, { headers: authHeaders() });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('PATCH /:id/status → 200 transition de statut', async () => {
    const createRes = await fetch(`${baseUrl}/tasks`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ title: 'Tâche statut', assignedToId: staffId }),
    });
    const { data: { taskId } } = await createRes.json() as { data: { taskId: string } };

    const res = await fetch(`${baseUrl}/tasks/${taskId}/status`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ status: 'EN_COURS' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  it('PATCH /:id/status → 500 transition invalide (A_FAIRE → VALIDE)', async () => {
    const createRes = await fetch(`${baseUrl}/tasks`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ title: 'Tâche invalide', assignedToId: staffId }),
    });
    const { data: { taskId } } = await createRes.json() as { data: { taskId: string } };

    const res = await fetch(`${baseUrl}/tasks/${taskId}/status`, {
      method: 'PATCH', headers: authHeaders(),
      body: JSON.stringify({ status: 'VALIDE' }),
    });
    expect(res.status).toBe(500);
  });

  it('POST / sans auth → 401', async () => {
    const res = await fetch(`${baseUrl}/tasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Non auth', assignedToId: staffId }),
    });
    expect(res.status).toBe(401);
  });
});