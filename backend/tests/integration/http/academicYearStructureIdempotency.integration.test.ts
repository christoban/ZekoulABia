/**
 * Test d'intégration — idempotence sur propose-next-structure / validate-structure.
 *
 * Règle : toute tentative de répéter une action déjà effectuée renvoie un rejet explicite
 * (409 Conflict), jamais un succès silencieux ni un reclonage/re-basculement par-dessus
 * l'état existant.
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

const headers = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

async function creerAnneesEtClasse(suffix: string) {
  const anneeActuelle = await prismaTest.academicYear.create({
    data: { schoolId, name: `actuelle-${suffix}`, startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: false, status: 'ACTIVE' },
  });
  const anneeSuivante = await prismaTest.academicYear.create({
    data: { schoolId, name: `suivante-${suffix}`, startDate: new Date('2026-09-01'), endDate: new Date('2027-07-31'), isCurrent: false, status: 'ACTIVE' },
  });
  await prismaTest.class.create({
    data: { schoolId, academicYearId: anneeActuelle.id, name: `Classe ${suffix}`, level: '3e', capacity: 40, status: 'ACTIVE' },
  });
  return { anneeActuelleId: anneeActuelle.id, anneeSuivanteId: anneeSuivante.id };
}

async function propose(anneeActuelleId: string, anneeSuivanteId: string) {
  return fetch(`${baseUrl}/academic-years/${anneeActuelleId}/propose-next-structure`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ anneeSuivanteId }),
  });
}

async function validate(anneeSuivanteId: string) {
  return fetch(`${baseUrl}/academic-years/${anneeSuivanteId}/validate-structure`, {
    method: 'POST',
    headers: headers(),
  });
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'structureIdempotence');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'idempotence-admin' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.classPromotion.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('Idempotence — propose-next-structure et validate-structure', () => {
  it('un 2e appel à propose-next-structure sur la même année cible renvoie 409 avec un message explicite', async () => {
    const { anneeActuelleId, anneeSuivanteId } = await creerAnneesEtClasse('propose-x2');

    const premier = await propose(anneeActuelleId, anneeSuivanteId);
    expect(premier.status).toBe(201);

    const second = await propose(anneeActuelleId, anneeSuivanteId);
    const body = await second.json() as { success: boolean; message?: string };
    expect(second.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.message).toContain('déjà proposée');
  });

  it('un 2e appel à validate-structure sur une structure déjà validée renvoie 409 avec un message explicite', async () => {
    const { anneeActuelleId, anneeSuivanteId } = await creerAnneesEtClasse('validate-x2');

    const proposition = await propose(anneeActuelleId, anneeSuivanteId);
    expect(proposition.status).toBe(201);

    const premiereValidation = await validate(anneeSuivanteId);
    expect(premiereValidation.status).toBe(200);

    const secondeValidation = await validate(anneeSuivanteId);
    const body = await secondeValidation.json() as { success: boolean; message?: string };
    expect(secondeValidation.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.message).toContain('déjà été validée');
  });
});
