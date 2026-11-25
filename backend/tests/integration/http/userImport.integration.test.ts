/**
 * Test d'intégration — POST /api/v2/users/import (preview / validate / confirm)
 *
 * Pattern copié depuis academicYearStructureCancel.integration.test.ts :
 * - bootstrapHexagonal(app) pour monter l'app Express complète
 * - prismaTest (vraie base de test) pour peupler/vérifier
 * - JWT signé pour simuler l'authentification admin
 * - fetch() pour les appels HTTP
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import * as XLSX from 'xlsx';
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
let staffToken: string;

const adminHeaders = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });
const teacherHeaders = () => ({ Cookie: `access_token=${teacherToken}` });
const staffHeaders = () => ({ Cookie: `access_token=${staffToken}`, 'Content-Type': 'application/json' });

function buildXlsxBuffer(headers: string[], rows: string[][]): ArrayBuffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, 'Données');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'userImport');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'import-admin' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const teacher = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: 'import-teacher' });
  teacherToken = jwt.sign(
    { userId: teacher.id, schoolId, role: 'TEACHER', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const staff = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STAFF', suffix: 'import-staff' });
  staffToken = jwt.sign(
    { userId: staff.id, schoolId, role: 'STAFF', permissions: ['MANAGE_ENROLLMENT'], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  // Créer une année académique pour les classes
  const year = await prismaTest.academicYear.create({
    data: { schoolId, name: `Année-${Date.now()}`, startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });

  // Pré-peupler des classes pour les tests de validation
  await prismaTest.class.createMany({
    data: [
      { schoolId, academicYearId: year.id, name: '6e A', level: '6e', capacity: 40, status: 'ACTIVE' },
      { schoolId, academicYearId: year.id, name: '5e B', level: '5e', capacity: 35, status: 'ACTIVE' },
    ],
    skipDuplicates: true,
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.grade.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v2/users/import/preview
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/v2/users/import/preview', () => {
  it('400 sans fichier joint', async () => {
    const res = await fetch(`${baseUrl}/users/import/preview`, {
      method: 'POST',
      headers: { Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType: 'STUDENT' }),
    });
    expect(res.status).toBe(400);
  });

  it('400 avec targetType invalide', async () => {
    const buffer = buildXlsxBuffer(['nom', 'prenom'], [['NGONO', 'Marie']]);
    const form = new FormData();
    form.append('targetType', 'INVALID');
    form.append('file', new Blob([buffer]), 'test.xlsx');

    const res = await fetch(`${baseUrl}/users/import/preview`, {
      method: 'POST',
      headers: { Cookie: `access_token=${adminToken}` },
      body: form,
    });
    expect(res.status).toBe(400);
  });

  it('200 avec fichier STUDENT valide → autoMapping détecté', async () => {
    const buffer = buildXlsxBuffer(['nom', 'prenom', 'email'], [
      ['NGONO', 'Marie', 'marie@test.cm'],
      ['ESSOMBA', 'Jean', 'jean@test.cm'],
    ]);
    const form = new FormData();
    form.append('targetType', 'STUDENT');
    form.append('file', new Blob([buffer]), 'test.xlsx');

    const res = await fetch(`${baseUrl}/users/import/preview`, {
      method: 'POST',
      headers: { Cookie: `access_token=${adminToken}` },
      body: form,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { headers: string[]; autoMapping: Record<string, string>; targetFields: string[]; sampleRows: Record<string, string>[]; totalRows: number } };
    expect(body.success).toBe(true);
    expect(body.data.headers).toContain('nom');
    expect(body.data.headers).toContain('prenom');
    expect(body.data.autoMapping).toHaveProperty('nom', 'nom');
    expect(body.data.autoMapping).toHaveProperty('prenom', 'prenom');
    expect(body.data.sampleRows).toHaveLength(2);
    expect(body.data.totalRows).toBe(2);
  });

  it('401 sans authentification', async () => {
    const buffer = buildXlsxBuffer(['nom', 'prenom'], [['NGONO', 'Marie']]);
    const form = new FormData();
    form.append('targetType', 'STUDENT');
    form.append('file', new Blob([buffer]), 'test.xlsx');

    const res = await fetch(`${baseUrl}/users/import/preview`, {
      method: 'POST',
      body: form,
    });
    expect(res.status).toBe(401);
  });

  it('403 avec rôle TEACHER (non-ADMIN)', async () => {
    const buffer = buildXlsxBuffer(['nom', 'prenom'], [['NGONO', 'Marie']]);
    const form = new FormData();
    form.append('targetType', 'STUDENT');
    form.append('file', new Blob([buffer]), 'test.xlsx');

    const res = await fetch(`${baseUrl}/users/import/preview`, {
      method: 'POST',
      headers: { Cookie: `access_token=${teacherToken}` },
      body: form,
    });
    expect(res.status).toBe(403);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v2/users/import/validate
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/v2/users/import/validate', () => {
  it('200 — ligne avec erreur (nom vide) → errorCount >= 1, status ERROR', async () => {
    const res = await fetch(`${baseUrl}/users/import/validate`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        targetType: 'STUDENT',
        rows: [
          { nom: '', prenom: 'Marie', email: 'marie@test.cm', telephone: '+237690000001' },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { errorCount: number; validatedRows: { status: string }[] } };
    expect(body.data.errorCount).toBeGreaterThanOrEqual(1);
    expect(body.data.validatedRows[0].status).toBe('ERROR');
  });

  it('200 — lignes valides → errorCount=0, toutes en status VALID', async () => {
    const res = await fetch(`${baseUrl}/users/import/validate`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        targetType: 'STUDENT',
        rows: [
          { nom: 'NGONO', prenom: 'Marie', email: 'marie@test.cm', telephone: '+237690000001', classe: '6e A' },
          { nom: 'ESSOMBA', prenom: 'Jean', email: 'jean@test.cm', telephone: '+237690000002', classe: '5e B' },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { errorCount: number; validatedRows: { status: string }[] } };
    expect(body.data.errorCount).toBe(0);
    expect(body.data.validatedRows.every((r) => r.status === 'VALID')).toBe(true);
  });

  it('401 sans authentification', async () => {
    const res = await fetch(`${baseUrl}/users/import/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType: 'STUDENT', rows: [] }),
    });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/v2/users/import/confirm
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/v2/users/import/confirm', () => {
  it('200 — CLASSE valide → success=1, classesCrees=1, classe en base', async () => {
    const className = `Classe-Confirm-${Date.now()}`;
    const res = await fetch(`${baseUrl}/users/import/confirm`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        targetType: 'CLASSE',
        confirmedRows: [{ nom: className, niveau: '6e' }],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { success: number; classesCrees: number } };
    expect(body.data.success).toBe(1);
    expect(body.data.classesCrees).toBe(1);

    const classe = await prismaTest.class.findFirst({ where: { schoolId, name: className } });
    expect(classe).not.toBeNull();
  });

  it('200 — ligne avec erreur → errors contient l\'entrée, success ne compte pas cette ligne', async () => {
    const res = await fetch(`${baseUrl}/users/import/confirm`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        targetType: 'CLASSE',
        confirmedRows: [
          { nom: 'Bonne-Classe', niveau: '6e' },
          { nom: 'Mauvaise', niveau: '' }, // niveau vide → erreur
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { success: number; errors: { ligne: number; erreur: string }[] } };
    expect(body.data.success).toBe(1);
    expect(body.data.errors).toHaveLength(1);
    expect(body.data.errors[0].ligne).toBe(2);
  });

  it('401 sans authentification', async () => {
    const res = await fetch(`${baseUrl}/users/import/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetType: 'CLASSE', confirmedRows: [] }),
    });
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Test bout en bout : preview → validate → confirm
// ═══════════════════════════════════════════════════════════════════════════════

describe('Bout en bout preview → validate → confirm (STUDENT)', () => {
  it('un vrai fichier xlsx produit un vrai User STUDENT en base', async () => {
    const studentEmail = `eleve-bEB-${Date.now()}@test.cm`;
    const buffer = buildXlsxBuffer(['nom', 'prenom', 'email', 'classe'], [
      ['NGONO', 'Marie', studentEmail, '6e A'],
    ]);

    // 1. Preview
    const previewForm = new FormData();
    previewForm.append('targetType', 'STUDENT');
    previewForm.append('file', new Blob([buffer]), 'test.xlsx');
    const previewRes = await fetch(`${baseUrl}/users/import/preview`, {
      method: 'POST',
      headers: { Cookie: `access_token=${adminToken}` },
      body: previewForm,
    });
    expect(previewRes.status).toBe(200);
    const previewBody = await previewRes.json() as { success: boolean; data: { autoMapping: Record<string, string> } };
    const mapping = previewBody.data.autoMapping;

    // 2. Validate
    const validateRes = await fetch(`${baseUrl}/users/import/validate`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        targetType: 'STUDENT',
        rows: [{ nom: 'NGONO', prenom: 'Marie', email: studentEmail, classe: '6e A' }],
        columnMapping: mapping,
      }),
    });
    expect(validateRes.status).toBe(200);
    const validateBody = await validateRes.json() as { success: boolean; data: { errorCount: number } };
    expect(validateBody.data.errorCount).toBe(0);

    // 3. Confirm
    const confirmRes = await fetch(`${baseUrl}/users/import/confirm`, {
      method: 'POST',
      headers: adminHeaders(),
      body: JSON.stringify({
        targetType: 'STUDENT',
        confirmedRows: [{ nom: 'NGONO', prenom: 'Marie', email: studentEmail, classe: '6e A' }],
        columnMapping: mapping,
      }),
    });
    expect(confirmRes.status).toBe(200);
    const confirmBody = await confirmRes.json() as { success: boolean; data: { success: number } };
    expect(confirmBody.data.success).toBe(1);

    // Vérification en base
    const user = await prismaTest.user.findFirst({ where: { schoolId, email: studentEmail.toLowerCase(), role: 'STUDENT' } });
    expect(user).not.toBeNull();
  }, 15000);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Rétrocompatibilité : ancien endpoint POST /api/v2/users/import
// ═══════════════════════════════════════════════════════════════════════════════

describe('POST /api/v2/users/import (rétrocompatibilité)', () => {
  it('fonctionne toujours avec role=STUDENT dans le body', async () => {
    const studentEmail = `ancien-import-${Date.now()}@test.cm`;
    const buffer = buildXlsxBuffer(['nom', 'prenom', 'email'], [
      ['TEST', 'Ancien', studentEmail],
    ]);
    const form = new FormData();
    form.append('role', 'STUDENT');
    form.append('file', new Blob([buffer]), 'test.xlsx');

    const res = await fetch(`${baseUrl}/users/import`, {
      method: 'POST',
      headers: { Cookie: `access_token=${adminToken}` },
      body: form,
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { success: number } };
    expect(body.data.success).toBe(1);

    const user = await prismaTest.user.findFirst({ where: { schoolId, email: studentEmail, role: 'STUDENT' } });
    expect(user).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// RBAC : Restriction de l'import par le Secrétariat (STAFF)
// ═══════════════════════════════════════════════════════════════════════════════

describe('RBAC — Import Excel par le Secrétaire (STAFF)', () => {
  it('autorise le secrétaire à valider des élèves (STUDENT)', async () => {
    const res = await fetch(`${baseUrl}/users/import/validate`, {
      method: 'POST',
      headers: staffHeaders(),
      body: JSON.stringify({
        targetType: 'STUDENT',
        rows: [{ nom: 'FOKOU', prenom: 'Paul', email: `fokou-${Date.now()}@test.cm`, classe: '6e A' }],
      }),
    });
    expect(res.status).toBe(200);
  });

  it('interdit au secrétaire d’importer des enseignants (TEACHER) avec HTTP 403', async () => {
    const res = await fetch(`${baseUrl}/users/import/validate`, {
      method: 'POST',
      headers: staffHeaders(),
      body: JSON.stringify({
        targetType: 'TEACHER',
        rows: [{ nom: 'PROF', prenom: 'Jean', email: `prof-${Date.now()}@test.cm`, matieres: 'Maths' }],
      }),
    });
    expect(res.status).toBe(403);
    const body = await res.json() as { success: boolean; message: string };
    expect(body.success).toBe(false);
    expect(body.message).toContain("autorisation");
  });

  it('interdit au secrétaire d’importer des membres du personnel (STAFF) avec HTTP 403', async () => {
    const res = await fetch(`${baseUrl}/users/import/validate`, {
      method: 'POST',
      headers: staffHeaders(),
      body: JSON.stringify({
        targetType: 'STAFF',
        rows: [{ nom: 'COLLÈGUE', prenom: 'Anne', email: `staff-${Date.now()}@test.cm` }],
      }),
    });
    expect(res.status).toBe(403);
  });

  it('interdit au secrétaire d’importer des classes (CLASSE) avec HTTP 403', async () => {
    const res = await fetch(`${baseUrl}/users/import/validate`, {
      method: 'POST',
      headers: staffHeaders(),
      body: JSON.stringify({
        targetType: 'CLASSE',
        rows: [{ nom: '4e C', niveau: '4e', capacite: '40' }],
      }),
    });
    expect(res.status).toBe(403);
  });
});

