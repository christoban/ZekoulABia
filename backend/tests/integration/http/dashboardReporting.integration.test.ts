/**
 * Test d'intégration — V1.13 « Reporting initial » (DashboardController).
 * Vérifie sur la vraie base :
 *  - /dashboard/stats : réponse rôle-dépendante (ADMIN compteurs globaux, TEACHER cours,
 *    STUDENT sa classe/moyenne, PARENT seulement ses activités) ;
 *  - scope : les activités d'un PARENT sont filtrées à ses propres actions,
 *    un Parent A ne voit pas les actions de Parent B ;
 *  - /dashboard/admin-badges : compteurs globaux ADMIN + RBAC (Élève/Parent → 403).
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
let teacherToken: string;
let studentToken: string;
let parentAToken: string;
let parentBToken: string;
let parentAId: string;

const headers = (token: string) => ({ Cookie: `access_token=${token}`, 'Content-Type': 'application/json' });

const signer = (userId: string, role: string) =>
  jwt.sign(
    { userId, schoolId, role, permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

const get = (path: string, token: string) =>
  fetch(`${baseUrl}/dashboard/${path}`, { method: 'GET', headers: headers(token) });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'dashReport');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = signer(admin.id, 'ADMIN');
  const teacher = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER' });
  teacherToken = signer(teacher.id, 'TEACHER');
  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
  studentToken = signer(student.id, 'STUDENT');
  const parentA = await creerUtilisateurTest(prismaTest, schoolId, { role: 'PARENT', suffix: 'dash-pa' });
  parentAId = parentA.id;
  parentAToken = signer(parentA.id, 'PARENT');
  const parentB = await creerUtilisateurTest(prismaTest, schoolId, { role: 'PARENT', suffix: 'dash-pb' });
  parentBToken = signer(parentB.id, 'PARENT');

  // Activités distinctes : une pour Admin, une pour Parent A
  await prismaTest.activitiesLog.createMany({
    data: [
      { userId: admin.id, schoolId, action: 'Admin action', description: 'x' },
      { userId: parentA.id, schoolId, action: 'Parent A action', description: 'x' },
      { userId: parentB.id, schoolId, action: 'Parent B action', description: 'x' },
    ],
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.activitiesLog.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
});

describe('V1.13 — DashboardController', () => {
  it('/stats ADMIN : compteurs globaux + activités récentes', async () => {
    const res = await get('stats', adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { stats: any };
    expect(typeof body.stats.totalStudents).toBe('number');
    expect(body.stats.recentActivity.some((a: string) => a.startsWith('Admin action'))).toBe(true);
  });

  it('/stats TEACHER : cours du jour + compteur de classes', async () => {
    const res = await get('stats', teacherToken);
    const body = await res.json() as { stats: any };
    expect(typeof body.stats.myClassesCount).toBe('number');
    expect(typeof body.stats.nextClass).toBe('string');
  });

  it('/stats STUDENT : sa classe et sa moyenne, pas de données globales', async () => {
    const res = await get('stats', studentToken);
    const body = await res.json() as { stats: any };
    expect(typeof body.stats.className).toBe('string');
    expect(typeof body.stats.avgGrade).toBe('string');
    expect(body.stats.totalStudents).toBeUndefined();
  });

  it('scope PARENT : ne voit que ses propres activités, jamais celles d\'un autre parent', async () => {
    const resA = await get('stats', parentAToken);
    const bodyA = await resA.json() as { stats: { recentActivity: string[] } };
    const contient = (s: string) => bodyA.stats.recentActivity.some((a) => a.startsWith(s));
    expect(contient('Parent A action')).toBe(true);
    expect(contient('Parent B action')).toBe(false);
    expect(contient('Admin action')).toBe(false);
  });

  it('/admin-badges : compteurs globaux pour ADMIN', async () => {
    const res = await get('admin-badges', adminToken);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { users: number; classes: number } };
    expect(body.data.users).toBeGreaterThanOrEqual(4);
    expect(typeof body.data.classes).toBe('number');
  });

  it('RBAC /admin-badges : Élève et Parent → 403 (données globales réservées)', async () => {
    expect((await get('admin-badges', studentToken)).status).toBe(403);
    expect((await get('admin-badges', parentAToken)).status).toBe(403);
  });
});