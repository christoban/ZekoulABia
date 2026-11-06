/**
 * Test d'intégration — flux matricule (import Excel + fuzzy matching), touché par le
 * retrait des casts `(this.prisma as any)` sur ImporterMatriculesUseCase,
 * ConfirmerCorrespondanceFuzzyUseCase et SignalerErreurCarteScolaireUseCase (colonne JSON
 * `resultDetails`). Vérifie de bout en bout que les écritures Prisma fonctionnent toujours
 * une fois les casts remplacés par un typage précis (pas juste que `tsc` passe).
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import * as XLSX from 'xlsx';
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
let studentExactUserId: string;
let studentExactProfileId: string;
let studentFuzzyUserId: string;
let studentFuzzyProfileId: string;
let studentFlagUserId: string;
let studentFlagProfileId: string;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'matricules');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  // Élève à correspondance exacte (nom/prénom identiques au fichier).
  const studentExact = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'ndzi-jean' });
  studentExactUserId = studentExact.id;
  await prismaTest.user.update({ where: { id: studentExact.id }, data: { firstName: 'Jean', lastName: 'Ndzi' } });
  const profileExact = await prismaTest.studentProfile.create({ data: { userId: studentExact.id, schoolId } });
  studentExactProfileId = profileExact.id;

  // Élève à correspondance approximative (variante orthographique du nom, même date de naissance).
  const studentFuzzy = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'mballa-marie' });
  studentFuzzyUserId = studentFuzzy.id;
  await prismaTest.user.update({ where: { id: studentFuzzy.id }, data: { firstName: 'Marie', lastName: 'Mballa' } });
  const profileFuzzy = await prismaTest.studentProfile.create({
    data: { userId: studentFuzzy.id, schoolId, dateOfBirth: new Date('2011-05-05') },
  });
  studentFuzzyProfileId = profileFuzzy.id;

  // Élève dont la correspondance approximative sera signalée (flag), pas confirmée.
  const studentFlag = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'ngoh-paul' });
  studentFlagUserId = studentFlag.id;
  await prismaTest.user.update({ where: { id: studentFlag.id }, data: { firstName: 'Paul', lastName: 'Ngoh' } });
  const profileFlag = await prismaTest.studentProfile.create({
    data: { userId: studentFlag.id, schoolId, dateOfBirth: new Date('2012-03-03') },
  });
  studentFlagProfileId = profileFlag.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.matriculeImportJob.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { userId: { in: [studentExactUserId, studentFuzzyUserId, studentFlagUserId] } } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

const authHeaders = () => ({ Cookie: `access_token=${adminToken}` });

let jobId: string;
let ligneFuzzyConfirmee: number;
let ligneFuzzySignalee: number;

describe('Import matricules + fuzzy matching — bout en bout', () => {
  it('POST /matricules/import : correspondance exacte stampée immédiatement, correspondances approximatives mises en attente', async () => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['nom', 'prenom', 'dateNaissance', 'matricule'],
      ['Ndzi', 'Jean', '', 'MATEXACT001'],
      ['Mbala', 'Marie', '05/05/2011', 'MATFUZZY002'],
      ['Ngo', 'Paul', '03/03/2012', 'MATFUZZY003'],
    ]);
    XLSX.utils.book_append_sheet(wb, ws, 'Matricules');
    const buffer: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'matricules.xlsx');

    const res = await fetch(`${baseUrl}/matricules/import`, {
      method: 'POST',
      headers: authHeaders(),
      body: form,
    });
    const body = await res.json() as {
      success: boolean; message?: string;
      data?: { jobId: string; matchedExact: number; fuzzyPending: number; fuzzyMatches: { ligne: number; studentProfileId: string; status: string }[] };
    };

    if (!body.success) throw new Error(`Échec import matricules : ${body.message ?? JSON.stringify(body)}`);
    expect(res.status).toBe(200);
    expect(body.data!.matchedExact).toBe(1);
    expect(body.data!.fuzzyPending).toBe(2);

    jobId = body.data!.jobId;
    const fuzzyForMarie = body.data!.fuzzyMatches.find(f => f.studentProfileId === studentFuzzyProfileId);
    const fuzzyForPaul = body.data!.fuzzyMatches.find(f => f.studentProfileId === studentFlagProfileId);
    expect(fuzzyForMarie).toBeDefined();
    expect(fuzzyForPaul).toBeDefined();
    ligneFuzzyConfirmee = fuzzyForMarie!.ligne;
    ligneFuzzySignalee = fuzzyForPaul!.ligne;

    const profileExact = await prismaTest.studentProfile.findUnique({ where: { id: studentExactProfileId } });
    expect(profileExact?.matricule).toBe('MATEXACT001');
    expect(profileExact?.matriculeMatchType).toBe('EXACT');

    // Les candidats fuzzy ne doivent PAS être matriculés tant que l'admin n'a pas tranché.
    const profileFuzzy = await prismaTest.studentProfile.findUnique({ where: { id: studentFuzzyProfileId } });
    expect(profileFuzzy?.matricule).toBeNull();

    const job = await prismaTest.matriculeImportJob.findUnique({ where: { id: jobId } });
    expect(job).not.toBeNull();
    expect((job!.resultDetails as unknown as { fuzzyMatches: unknown[] }).fuzzyMatches.length).toBe(2);
  });

  it("POST /matricules/fuzzy-matches/:jobId/:ligne/confirm : applique le matricule et trace matchedRowsFuzzyConfirmed", async () => {
    const res = await fetch(`${baseUrl}/matricules/fuzzy-matches/${jobId}/${ligneFuzzyConfirmee}/confirm`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const body = await res.json() as { success: boolean; message?: string; data?: { studentProfileId: string; matricule: string } };

    if (!body.success) throw new Error(`Échec confirmation fuzzy : ${body.message ?? JSON.stringify(body)}`);
    expect(res.status).toBe(200);
    expect(body.data!.matricule).toBe('MATFUZZY002');

    const profile = await prismaTest.studentProfile.findUnique({ where: { id: studentFuzzyProfileId } });
    expect(profile?.matricule).toBe('MATFUZZY002');
    expect(profile?.matriculeMatchType).toBe('FUZZY_CONFIRMED');

    const job = await prismaTest.matriculeImportJob.findUnique({ where: { id: jobId } });
    expect(job?.matchedRowsFuzzyConfirmed).toBe(1);
    const details = job!.resultDetails as unknown as { fuzzyMatches: { ligne: number; status: string }[] };
    const entry = details.fuzzyMatches.find(f => f.ligne === ligneFuzzyConfirmee);
    expect(entry?.status).toBe('CONFIRMED');
  });

  it("POST /matricules/fuzzy-matches/:jobId/:ligne/flag : ne matricule pas l'élève et trace flaggedForCorrection", async () => {
    const res = await fetch(`${baseUrl}/matricules/fuzzy-matches/${jobId}/${ligneFuzzySignalee}/flag`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const body = await res.json() as { success: boolean; message?: string };

    if (!body.success) throw new Error(`Échec signalement fuzzy : ${body.message ?? JSON.stringify(body)}`);
    expect(res.status).toBe(200);

    const profile = await prismaTest.studentProfile.findUnique({ where: { id: studentFlagProfileId } });
    expect(profile?.matricule).toBeNull();

    const job = await prismaTest.matriculeImportJob.findUnique({ where: { id: jobId } });
    expect(job?.flaggedForCorrection).toBe(1);
    const details = job!.resultDetails as unknown as { fuzzyMatches: { ligne: number; status: string }[] };
    const entry = details.fuzzyMatches.find(f => f.ligne === ligneFuzzySignalee);
    expect(entry?.status).toBe('FLAGGED');
  });
});
