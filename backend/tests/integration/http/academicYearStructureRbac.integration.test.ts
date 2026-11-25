/**
 * Test d'intégration — RBAC sur propose-next-structure / validate-structure.
 *
 * Règle métier tranchée : propose-next-structure accepte Admin OU Censeur ; validate-structure
 * n'accepte QUE Admin, sans exception. Censeur n'étant pas une valeur de role (UserRole =
 * ADMIN|STAFF|TEACHER|PARENT|STUDENT — voir schema.prisma) mais un staffTitle sous STAFF, le
 * check réutilise la permission VALIDATE_GRADES comme proxy, exactement comme
 * TenirConseilClasseUseCase/ValiderNoteUseCase le font déjà pour "Admin ou Censeur".
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
let anneeActuelleId: string;
let anneeSuivanteId: string;

function creerToken(userId: string, role: string, permissions: string[] = []): string {
  return jwt.sign({ userId, schoolId, role, permissions, tokenType: 'access' }, process.env.JWT_SECRET!);
}

const headersAvec = (token: string) => ({ Cookie: `access_token=${token}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'structureRbac');
  schoolId = school.id;

  const anneeActuelle = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  anneeActuelleId = anneeActuelle.id;

  const anneeSuivante = await prismaTest.academicYear.create({
    data: { schoolId, name: '2026-2027', startDate: new Date('2026-09-01'), endDate: new Date('2027-07-31'), isCurrent: false, status: 'ACTIVE' },
  });
  anneeSuivanteId = anneeSuivante.id;

  await prismaTest.class.create({
    data: { schoolId, academicYearId: anneeActuelleId, name: '3e A', level: '3e', capacity: 40, status: 'ACTIVE' },
  });
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

async function propose(token: string) {
  return fetch(`${baseUrl}/academic-years/${anneeActuelleId}/propose-next-structure`, {
    method: 'POST',
    headers: headersAvec(token),
    body: JSON.stringify({ anneeSuivanteId }),
  });
}

async function validate(token: string) {
  return fetch(`${baseUrl}/academic-years/${anneeSuivanteId}/validate-structure`, {
    method: 'POST',
    headers: headersAvec(token),
  });
}

describe('RBAC — propose-next-structure et validate-structure', () => {
  it('Admin peut proposer ET valider', async () => {
    const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'rbac-admin' });
    const token = creerToken(admin.id, 'ADMIN');

    const resPropose = await propose(token);
    expect(resPropose.status).toBe(201);

    const resValidate = await validate(token);
    expect(resValidate.status).toBe(200);
  });

  it('Censeur (STAFF + VALIDATE_GRADES) peut proposer mais ne peut PAS valider (403)', async () => {
    const censeur = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STAFF', suffix: 'rbac-censeur' });
    const token = creerToken(censeur.id, 'STAFF', ['VALIDATE_GRADES']);

    // Réutilise la proposition de l'Admin depuis le test précédent (déjà validée) : reproposer
    // nécessite d'abord de nettoyer les classes DRAFT de anneeSuivanteId.
    await prismaTest.classPromotion.deleteMany({ where: { schoolId } });
    await prismaTest.class.deleteMany({ where: { schoolId, academicYearId: anneeSuivanteId } });

    const resPropose = await propose(token);
    expect(resPropose.status).toBe(201);

    const resValidate = await validate(token);
    expect(resValidate.status).toBe(403);
  });

  async function verifieRoleExclu(role: 'TEACHER' | 'PARENT' | 'STUDENT') {
    const utilisateur = await creerUtilisateurTest(prismaTest, schoolId, { role, suffix: `rbac-${role.toLowerCase()}` });
    const token = creerToken(utilisateur.id, role);

    const resPropose = await propose(token);
    expect(resPropose.status).toBe(403);

    const resValidate = await validate(token);
    expect(resValidate.status).toBe(403);
  }

  it('Enseignant ne peut ni proposer ni valider (403 sur les deux routes)', () => verifieRoleExclu('TEACHER'));
  it('Parent ne peut ni proposer ni valider (403 sur les deux routes)', () => verifieRoleExclu('PARENT'));
  it('Élève ne peut ni proposer ni valider (403 sur les deux routes)', () => verifieRoleExclu('STUDENT'));

  it('STAFF sans VALIDATE_GRADES (autre titre) ne peut pas proposer non plus (403)', async () => {
    const staff = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STAFF', suffix: 'rbac-staff-sans-perm' });
    const token = creerToken(staff.id, 'STAFF', ['MANAGE_LIBRARY']);

    const resPropose = await propose(token);
    expect(resPropose.status).toBe(403);
  });
});
