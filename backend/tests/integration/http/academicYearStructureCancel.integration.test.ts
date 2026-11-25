/**
 * Test d'intégration — POST /academic-years/:id/cancel-proposed-structure (AnnulerStructureProposeeUseCase).
 *
 * Couvre ce qu'un test unitaire avec doubles en mémoire ne peut pas prouver : que
 * ClasseRepository.annulerPropositionAnnee() supprime réellement les classes DRAFT ET leurs
 * mappings ClassPromotion en une seule transaction contre la vraie base, et que le cycle
 * proposer → annuler → reproposer ne laisse aucun doublon résiduel (le garde-fou anti-doublon de
 * ProposerStructureAnneeSuivanteUseCase se base sur findBySchoolAndYear — s'il restait la
 * moindre classe DRAFT orpheline après annulation, la reproposition serait bloquée à tort).
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

async function cancel(anneeSuivanteId: string) {
  return fetch(`${baseUrl}/academic-years/${anneeSuivanteId}/cancel-proposed-structure`, {
    method: 'POST',
    headers: headers(),
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

  const school = await creerEcoleTest(prismaTest, 'structureCancel');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'cancel-admin' });
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

describe('POST /academic-years/:id/cancel-proposed-structure', () => {
  it('proposer → annuler → reproposer : nettoie DRAFT + ClassPromotion en une transaction, sans doublon résiduel', async () => {
    const { anneeActuelleId, anneeSuivanteId } = await creerAnneesEtClasse('cycle');

    const premiereProposition = await propose(anneeActuelleId, anneeSuivanteId);
    expect(premiereProposition.status).toBe(201);
    expect(await prismaTest.class.count({ where: { schoolId, academicYearId: anneeSuivanteId } })).toBe(1);
    expect(await prismaTest.classPromotion.count({ where: { schoolId, academicYearId: anneeActuelleId } })).toBe(1);

    const annulation = await cancel(anneeSuivanteId);
    const bodyAnnulation = await annulation.json() as { success: boolean; message?: string; data?: { classesSupprimees: number } };
    if (!bodyAnnulation.success) throw new Error(`Échec annulation : ${bodyAnnulation.message ?? JSON.stringify(bodyAnnulation)}`);
    expect(annulation.status).toBe(200);
    expect(bodyAnnulation.data!.classesSupprimees).toBe(1);

    // Transaction unique : classes DRAFT ET mappings ClassPromotion disparus ensemble.
    expect(await prismaTest.class.count({ where: { schoolId, academicYearId: anneeSuivanteId } })).toBe(0);
    expect(await prismaTest.classPromotion.count({ where: { schoolId, academicYearId: anneeActuelleId } })).toBe(0);

    const secondeProposition = await propose(anneeActuelleId, anneeSuivanteId);
    const bodySeconde = await secondeProposition.json() as { success: boolean; message?: string; data?: { classesProposees: unknown[] } };
    if (!bodySeconde.success) throw new Error(`Échec reproposition : ${bodySeconde.message ?? JSON.stringify(bodySeconde)}`);
    expect(secondeProposition.status).toBe(201);
    expect(bodySeconde.data!.classesProposees).toHaveLength(1);

    // Pas de doublon résiduel : une seule classe DRAFT, un seul mapping.
    expect(await prismaTest.class.count({ where: { schoolId, academicYearId: anneeSuivanteId } })).toBe(1);
    expect(await prismaTest.classPromotion.count({ where: { schoolId, academicYearId: anneeActuelleId } })).toBe(1);
  });

  it('refuse (409) d\'annuler une structure déjà validée, sans toucher aux classes ACTIVE', async () => {
    const { anneeActuelleId, anneeSuivanteId } = await creerAnneesEtClasse('deja-validee');

    expect((await propose(anneeActuelleId, anneeSuivanteId)).status).toBe(201);
    expect((await validate(anneeSuivanteId)).status).toBe(200);

    const res = await cancel(anneeSuivanteId);
    const body = await res.json() as { success: boolean; message?: string };
    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.message).toContain('déjà été validée');

    const classe = await prismaTest.class.findFirst({ where: { schoolId, academicYearId: anneeSuivanteId } });
    expect(classe?.status).toBe('ACTIVE');
  });

  it('refuse (404) d\'annuler quand rien n\'a été proposé pour cette année', async () => {
    const { anneeSuivanteId } = await creerAnneesEtClasse('rien-a-annuler');

    const res = await cancel(anneeSuivanteId);
    const body = await res.json() as { success: boolean; message?: string };
    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.message).toContain('rien à annuler');
  });
});
