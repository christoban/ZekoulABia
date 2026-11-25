/**
 * Test d'intégration — CoreDomainController.createPeriod (POST /core-domain/academic-periods)
 * Prérequis : bun test --env-file .env.test
 *
 * orderIndex (requis par le schéma, sans défaut) n'était jamais fourni par ce endpoint — masqué
 * par un `as any` sur le payload d'écriture, il aurait échoué avec une violation NOT NULL à
 * chaque appel réel. Aucun test n'existait pour ce controller.
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

const authHeaders = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'coreDomain');
  schoolId = school.id;
  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30') },
  });
  academicYearId = annee.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.academicPeriod.deleteMany({ where: { academicYearId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('CoreDomainController.createPeriod — orderIndex stampé correctement', () => {
  it('crée une première période avec orderIndex=1 (au lieu de planter sur NOT NULL)', async () => {
    const res = await fetch(`${baseUrl}/core-domain/academic-periods`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        academicYearId, name: 'Trimestre 1', type: 'TRIMESTER',
        startDate: '2025-09-01', endDate: '2025-12-20', isCurrent: true,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { id: string; orderIndex: number };
    expect(body.orderIndex).toBe(1);

    const enBase = await prismaTest.academicPeriod.findUnique({ where: { id: body.id } });
    expect(enBase?.orderIndex).toBe(1);
  });

  it('une deuxième période pour la même année reçoit orderIndex=2', async () => {
    const res = await fetch(`${baseUrl}/core-domain/academic-periods`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        academicYearId, name: 'Trimestre 2', type: 'TRIMESTER',
        startDate: '2026-01-05', endDate: '2026-03-31', isCurrent: false,
      }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { orderIndex: number };
    expect(body.orderIndex).toBe(2);
  });
});
