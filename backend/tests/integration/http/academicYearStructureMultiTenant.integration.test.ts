/**
 * Test d'intégration — isolation multi-tenant sur propose-next-structure, validate-structure et
 * cancel-proposed-structure.
 *
 * Contexte : l'audit initial du projet n'avait trouvé aucun test vérifiant qu'un token école A
 * ne peut pas agir sur les données d'une école B. Ces 3 routes touchent la structure complète
 * d'une année scolaire — vérifiées explicitement plutôt que supposées protégées par le mécanisme
 * général (le check schoolId existe déjà dans les 3 use cases, mais rien ne le prouvait avant ce
 * fichier).
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
let schoolAId: string;
let schoolBId: string;
let tokenEcoleA: string;
// Année académique appartenant à l'école B — jamais accédée avec un token école A.
let anneeEcoleBId: string;
let anneeSuivanteEcoleBId: string;

const headers = () => ({ Cookie: `access_token=${tokenEcoleA}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const schoolA = await creerEcoleTest(prismaTest, 'multiTenantA');
  schoolAId = schoolA.id;
  const schoolB = await creerEcoleTest(prismaTest, 'multiTenantB');
  schoolBId = schoolB.id;

  const adminA = await creerUtilisateurTest(prismaTest, schoolAId, { role: 'ADMIN', suffix: 'mt-admin-a' });
  tokenEcoleA = jwt.sign(
    { userId: adminA.id, schoolId: schoolAId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  // Structure appartenant entièrement à l'école B : année en cours + classe active + année
  // suivante avec une structure déjà proposée (DRAFT), pour que validate/cancel aient une cible
  // réelle sur laquelle mordre si l'isolation était cassée.
  const anneeActuelleB = await prismaTest.academicYear.create({
    data: { schoolId: schoolBId, name: 'actuelle-B', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: false, status: 'ACTIVE' },
  });
  anneeEcoleBId = anneeActuelleB.id;
  const anneeSuivanteB = await prismaTest.academicYear.create({
    data: { schoolId: schoolBId, name: 'suivante-B', startDate: new Date('2026-09-01'), endDate: new Date('2027-07-31'), isCurrent: false, status: 'ACTIVE' },
  });
  anneeSuivanteEcoleBId = anneeSuivanteB.id;
  await prismaTest.class.create({
    data: { schoolId: schoolBId, academicYearId: anneeActuelleB.id, name: 'Classe B', level: '3e', capacity: 40, status: 'ACTIVE' },
  });
  // Classe DRAFT déjà proposée sur l'année suivante B — cible pour validate/cancel.
  await prismaTest.class.create({
    data: { schoolId: schoolBId, academicYearId: anneeSuivanteB.id, name: 'Classe B (proposée)', level: '3e', capacity: 40, status: 'DRAFT' },
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const schoolId of [schoolAId, schoolBId]) {
    await prismaTest.classPromotion.deleteMany({ where: { schoolId } });
    await prismaTest.enrollment.deleteMany({ where: { schoolId } });
    await prismaTest.class.deleteMany({ where: { schoolId } });
    await prismaTest.academicYear.deleteMany({ where: { schoolId } });
    await prismaTest.user.deleteMany({ where: { schoolId } });
    await nettoyerEcole(prismaTest, schoolId);
  }
  await prismaTest.$disconnect();
});

describe('Isolation multi-tenant — propose/validate/cancel-structure', () => {
  it("propose-next-structure : un token école A sur l'année de l'école B est refusé, sans succès ni fuite de données", async () => {
    const res = await fetch(`${baseUrl}/academic-years/${anneeEcoleBId}/propose-next-structure`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ anneeSuivanteId: anneeSuivanteEcoleBId }),
    });
    const body = await res.json() as { success: boolean; message?: string; data?: unknown };

    expect([403, 404]).toContain(res.status);
    expect(body.success).toBe(false);
    expect(body.data).toBeUndefined();

    // Aucune classe de l'école B n'a été touchée par la tentative.
    const classesB = await prismaTest.class.findMany({ where: { schoolId: schoolBId, academicYearId: anneeSuivanteEcoleBId } });
    expect(classesB).toHaveLength(1);
    expect(classesB[0]?.status).toBe('DRAFT');
  });

  it("validate-structure : un token école A sur l'année suivante de l'école B est refusé, sans basculer les classes DRAFT en ACTIVE", async () => {
    const res = await fetch(`${baseUrl}/academic-years/${anneeSuivanteEcoleBId}/validate-structure`, {
      method: 'POST',
      headers: headers(),
    });
    const body = await res.json() as { success: boolean; message?: string; data?: unknown };

    expect([403, 404]).toContain(res.status);
    expect(body.success).toBe(false);
    expect(body.data).toBeUndefined();

    const classeDraftB = await prismaTest.class.findFirst({ where: { schoolId: schoolBId, academicYearId: anneeSuivanteEcoleBId } });
    expect(classeDraftB?.status).toBe('DRAFT');
  });

  it("cancel-proposed-structure : un token école A sur l'année suivante de l'école B est refusé, sans supprimer la classe DRAFT de l'école B", async () => {
    const res = await fetch(`${baseUrl}/academic-years/${anneeSuivanteEcoleBId}/cancel-proposed-structure`, {
      method: 'POST',
      headers: headers(),
    });
    const body = await res.json() as { success: boolean; message?: string; data?: unknown };

    expect([403, 404]).toContain(res.status);
    expect(body.success).toBe(false);
    expect(body.data).toBeUndefined();

    const classeDraftB = await prismaTest.class.findFirst({ where: { schoolId: schoolBId, academicYearId: anneeSuivanteEcoleBId } });
    expect(classeDraftB).not.toBeNull();
  });
});
