/**
 * Test d'intégration — OrientationController.creer, touché par le retrait du cast
 * `mainConcern as any` (enum Prisma `TypePreoccupation`). Le cast masquait l'absence de
 * validation — une valeur hors énumération levait une PrismaClientValidationError (500) au
 * lieu d'un 400 propre. Une validation a été ajoutée au passage. Vérifie sur la vraie base
 * le rejet propre ET la création réussie (round-trip de l'enum sans cast).
 *
 * Révèle au passage un second bug indépendant, découvert en écrivant ce test : le contrôleur
 * renvoyait l'entité de domaine FicheOrientation telle quelle dans la réponse JSON — ses champs
 * (getters de classe, non énumérables) disparaissaient à la sérialisation, ne laissant que le
 * champ privé `props`. Toute réponse de création renvoyait `data.props.id`, jamais `data.id`.
 * Corrigé en construisant un DTO plat dans le contrôleur.
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

  const school = await creerEcoleTest(prismaTest, 'orientationFiche');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isCurrent: true },
  });
  academicYearId = annee.id;
  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
  studentId = student.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.ficheOrientation.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('OrientationController.creer — validation mainConcern (enum TypePreoccupation) sans cast any', () => {
  it('rejette une valeur mainConcern hors énumération avec un 400 propre', async () => {
    const res = await fetch(`${baseUrl}/orientation/fiches`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ studentId, academicYearId, mainConcern: 'INEXISTANT' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { message?: string };
    expect(body.message).toContain('mainConcern doit être');

    const fiche = await prismaTest.ficheOrientation.findFirst({ where: { studentId } });
    expect(fiche).toBeNull();
  });

  it('crée la fiche avec un mainConcern valide', async () => {
    const res = await fetch(`${baseUrl}/orientation/fiches`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ studentId, academicYearId, mainConcern: 'SCOLAIRE' }),
    });
    const body = await res.json() as { success: boolean; data?: { id: string; mainConcern: string; studentId: string } };
    if (!body.success) throw new Error(`Échec création fiche : ${JSON.stringify(body)}`);
    expect(res.status).toBe(201);

    // Le bug (data.props.id au lieu de data.id) aurait fait échouer cette lecture directe.
    expect(body.data!.id).toBeString();
    expect(body.data!.studentId).toBe(studentId);
    expect(body.data!.mainConcern).toBe('SCOLAIRE');

    const fiche = await prismaTest.ficheOrientation.findUnique({ where: { id: body.data!.id } });
    expect(fiche?.mainConcern).toBe('SCOLAIRE');
  });
});
