/**
 * Test d'intégration — V1.9 Absences et discipline.
 *
 * Deux volets :
 *  - la justification d'absence est maintenant PERSISTÉE sur `Attendance`
 *    (justification / justifiedById / justifiedAt) — avant, elle n'allait que
 *    dans le journal IA et se perdait à la relecture ;
 *  - le CRUD discipline (GET/POST/PATCH /api/v2/discipline) a été extrait de
 *    hexagonal.bootstrap.ts vers DisciplineController + discipline.routes —
 *    on vérifie qu'il répond toujours identiquement via la vraie base.
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
let studentId: string;
let classId: string;

const authHeaders = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'disciplineV19');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
  studentId = student.id;

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026 V1.9', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  const classe = await prismaTest.class.create({
    data: {
      name: 'Classe V1.9',
      schoolId,
      academicYearId: annee.id,
    },
  });
  classId = classe.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await new Promise((r) => setTimeout(r, 500));
  await prismaTest.aIActionAuditLog.deleteMany({ where: { schoolId } });
  await prismaTest.notification.deleteMany({ where: { schoolId } });
  await prismaTest.attendance.deleteMany({ where: { schoolId } });
  await prismaTest.disciplineRecord.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('V1.9 — justification d\'absence persistée', () => {
  it('PERSISTE justification, justifiedById et justifiedAt sur Attendance', async () => {
    const attendance = await prismaTest.attendance.create({
      data: { schoolId, studentId, classId, date: new Date('2026-02-01'), status: 'ABSENT' },
    });

    const res = await fetch(`${baseUrl}/attendance/${attendance.id}/justify`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ justification: 'Certificat médical (paludisme)' }),
    });
    const body = await res.json() as { success: boolean };
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    const reloaded = await prismaTest.attendance.findUnique({ where: { id: attendance.id } });
    expect(reloaded?.status).toBe('ABSENT_JUSTIFIED');
    expect(reloaded?.justification).toBe('Certificat médical (paludisme)');
    expect(reloaded?.justifiedById).toBeDefined();
    expect(reloaded?.justifiedAt).toBeInstanceOf(Date);
  });

  it('refuse de justifier autre chose qu\'une absence', async () => {
    const attendance = await prismaTest.attendance.create({
      data: { schoolId, studentId, classId, date: new Date('2026-02-02'), status: 'PRESENT' },
    });

    const res = await fetch(`${baseUrl}/attendance/${attendance.id}/justify`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ justification: 'Essai' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('V1.9 — CRUD discipline extrait de bootstrap.ts', () => {
  it('POST /discipline crée une sanction et PATCH /discipline/:id/lift la lève', async () => {
    const created = await fetch(`${baseUrl}/discipline`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ studentId, type: 'WARNING_WRITTEN', reason: 'Retard répété' }),
    });
    expect(created.status).toBe(201);
    const createdBody = await created.json() as { data: { id: string; status: string } };
    expect(createdBody.data.status).toBe('ACTIVE');

    const lifted = await fetch(`${baseUrl}/discipline/${createdBody.data.id}/lift`, {
      method: 'PATCH',
      headers: authHeaders(),
    });
    expect(lifted.status).toBe(200);
    const liftedBody = await lifted.json() as { data: { status: string } };
    expect(liftedBody.data.status).toBe('LIFTED');
  });

  it('GET /discipline liste les sanctions avec pagination', async () => {
    const res = await fetch(`${baseUrl}/discipline?studentId=${studentId}`, {
      method: 'GET',
      headers: authHeaders(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ id: string }>; pagination: { total: number } };
    expect(body.pagination.total).toBeGreaterThan(0);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('refuse COUNCIL_DECISION en création directe (workflow Conseil Art. 30)', async () => {
    const res = await fetch(`${baseUrl}/discipline`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ studentId, type: 'PERMANENT_EXCLUSION', reason: 'Faute grave' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('CONSEIL_DISCIPLINE_REQUIS');
  });
});