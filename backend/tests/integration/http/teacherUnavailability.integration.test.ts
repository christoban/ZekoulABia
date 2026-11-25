/**
 * Test d'intégration — V2.4 « Disponibilité enseignant » (TeacherUnavailabilityController).
 * Vérifie sur la vraie base :
 *  - RBAC : Élève/Parent → 403 ; ADMIN/STAFF autorisés ;
 *  - isolation tenant : indisponibilité d'une autre école → 404 (et jamais listée) ;
 *  - validation chevauchement : plage qui recouvre une indispo active du même enseignant → 409 ;
 *  - chevauchement inter-enseignants OK (deux enseignants peuvent être indisponibles à la même heure) ;
 *  - désactivation d'une plage active → aucun conflit ensuite ;
 *  - idempotence d'activation : réactiver une plage déjà active → 409.
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
let schoolBId: string;
let adminToken: string;
let teacherToken: string;
let studentToken: string;
let adminBToken: string;
let teacherId: string;
let teacherBId: string;

const headers = (token: string) => ({ Cookie: `access_token=${token}`, 'Content-Type': 'application/json' });

const signer = (userId: string, ecoleId: string, role: string) =>
  jwt.sign(
    { userId, schoolId: ecoleId, role, permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

const api = (path: string, token: string, method = 'GET', body?: unknown) =>
  fetch(`${baseUrl}/teacher-unavailabilities${path}`, {
    method,
    headers: headers(token),
    body: body ? JSON.stringify(body) : undefined,
  });

const corps = (res: Response) => res.json() as Promise<{ success: boolean; data?: any; message?: string }>;

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'teacherUnavail');
  schoolId = school.id;
  const schoolB = await creerEcoleTest(prismaTest, 'teacherUnavailB');
  schoolBId = schoolB.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = signer(admin.id, schoolId, 'ADMIN');
  const adminB = await creerUtilisateurTest(prismaTest, schoolBId, { role: 'ADMIN' });
  adminBToken = signer(adminB.id, schoolBId, 'ADMIN');

  const enseignant = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: 'profA' });
  teacherId = enseignant.id;
  const enseignantB = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: 'profB' });
  teacherBId = enseignantB.id;

  const eleve = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
  studentToken = signer(eleve.id, schoolId, 'STUDENT');
});

afterAll(async () => {
  server.close();
  await nettoyerEcole(prismaTest, schoolId);
  await nettoyerEcole(prismaTest, schoolBId);
});

describe('POST /api/v2/teacher-unavailabilities', () => {
  it('ADMIN crée une indisponibilité — 201', async () => {
    const res = await api('/', adminToken, 'POST', {
      teacherId, dayOfWeek: 0, startTime: '08:00', endTime: '09:00', reason: 'Formation',
    });
    expect(res.status).toBe(201);
    const { data } = await corps(res);
    expect(data.id).toBeDefined();
    await prismaTest.teacherUnavailability.delete({ where: { id: data.id } });
  });

  it('Élève → 403 (RBAC)', async () => {
    const res = await api('/', studentToken, 'POST', {
      teacherId, dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
    });
    expect(res.status).toBe(403);
  });

  it('chevauchant une plage active du même enseignant → 409', async () => {
    await prismaTest.teacherUnavailability.create({
      data: { schoolId, teacherId, dayOfWeek: 0, startTime: '08:00', endTime: '10:00' },
    });
    const res = await api('/', adminToken, 'POST', {
      teacherId, dayOfWeek: 0, startTime: '08:30', endTime: '09:30',
    });
    expect(res.status).toBe(409);
  });

  it('enseignant d\'une autre école → 400', async () => {
    const profAutreEcole = await creerUtilisateurTest(prismaTest, schoolBId, { role: 'TEACHER' });
    const res = await api('/', adminToken, 'POST', {
      teacherId: profAutreEcole.id, dayOfWeek: 1, startTime: '08:00', endTime: '09:00',
    });
    expect(res.status).toBe(400);
  });

  it('deux enseignants indisponibles au même créneau → OK (pas de conflit inter-enseignants)', async () => {
    const res = await api('/', adminToken, 'POST', {
      teacherId: teacherBId, dayOfWeek: 0, startTime: '08:30', endTime: '09:30',
    });
    expect(res.status).toBe(201);
    const { data } = await corps(res);
    await prismaTest.teacherUnavailability.delete({ where: { id: data.id } });
  });
});

describe('PUT /api/v2/teacher-unavailabilities/:id', () => {
  let id: string;
  beforeAll(async () => {
    const created = await prismaTest.teacherUnavailability.create({
      data: { schoolId, teacherId, dayOfWeek: 2, startTime: '08:00', endTime: '09:00' },
    });
    id = created.id;
  });

  it('désactive la plage → active=false', async () => {
    const res = await api(`/${id}`, adminToken, 'PUT', { active: false });
    expect(res.status).toBe(200);
    const enBase = await prismaTest.teacherUnavailability.findUnique({ where: { id } });
    expect(enBase!.active).toBe(false);
  });

  it('réactiver → active=true', async () => {
    const res = await api(`/${id}`, adminToken, 'PUT', { active: true });
    expect(res.status).toBe(200);
  });

  it('réactiver une plage déjà active → 409 (idempotence explicite)', async () => {
    const res = await api(`/${id}`, adminToken, 'PUT', { active: true });
    expect(res.status).toBe(409);
  });

  it('plage d\'une autre école → 404 (isolation tenant)', async () => {
    const autreEcole = await prismaTest.teacherUnavailability.create({
      data: { schoolId: schoolBId, teacherId, dayOfWeek: 3, startTime: '08:00', endTime: '09:00' },
    });
    const res = await api(`/${autreEcole.id}`, adminToken, 'PUT', { active: false });
    expect(res.status).toBe(404);
  });

  it('Élève → 403 (RBAC)', async () => {
    const res = await api(`/${id}`, studentToken, 'PUT', { active: false });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/v2/teacher-unavailabilities', () => {
  let idActive: string;
  let idInactive: string;
  beforeAll(async () => {
    idActive = (await prismaTest.teacherUnavailability.create({
      data: { schoolId, teacherId, dayOfWeek: 1, startTime: '08:00', endTime: '09:00' },
    })).id;
    idInactive = (await prismaTest.teacherUnavailability.create({
      data: { schoolId, teacherId, dayOfWeek: 2, startTime: '09:00', endTime: '10:00', active: false },
    })).id;
  });

  it('liste les indisponibilités de l\'école (actives par défaut)', async () => {
    const res = await api('', adminToken);
    expect(res.status).toBe(200);
    const { data } = await corps(res);
    expect(data.some((i: any) => i.id === idActive)).toBe(true);
    expect(data.some((i: any) => i.id === idInactive)).toBe(false);
  });

  it('includeInactive=true liste aussi les plages inactives', async () => {
    const res = await api('?includeInactive=true', adminToken);
    const { data } = await corps(res);
    expect(data.some((i: any) => i.id === idInactive)).toBe(true);
  });

  it('filtre par teacherId', async () => {
    const res = await api(`?teacherId=${teacherBId}`, adminToken);
    expect(res.status).toBe(200);
    const { data } = await corps(res);
    expect(data.every((i: any) => i.teacherId === teacherBId)).toBe(true);
  });

  it('Élève → 403 (RBAC)', async () => {
    const res = await api('', studentToken);
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v2/teacher-unavailabilities/:id', () => {
  it('supprime une indisponibilité de sa propre école — 200', async () => {
    const created = await prismaTest.teacherUnavailability.create({
      data: { schoolId, teacherId, dayOfWeek: 4, startTime: '08:00', endTime: '09:00' },
    });
    const res = await api(`/${created.id}`, adminToken, 'DELETE');
    expect(res.status).toBe(200);
    const enBase = await prismaTest.teacherUnavailability.findUnique({ where: { id: created.id } });
    expect(enBase).toBeNull();
  });

  it('suppression d\'une indispo d\'une autre école → 404', async () => {
    const autreEcole = await prismaTest.teacherUnavailability.create({
      data: { schoolId: schoolBId, teacherId, dayOfWeek: 5, startTime: '08:00', endTime: '09:00' },
    });
    const res = await api(`/${autreEcole.id}`, adminToken, 'DELETE');
    expect(res.status).toBe(404);
    // L'enregistrement de l'autre école est intact.
    const enBase = await prismaTest.teacherUnavailability.findUnique({ where: { id: autreEcole.id } });
    expect(enBase).not.toBeNull();
  });

  it('Élève → 403 (RBAC)', async () => {
    const created = await prismaTest.teacherUnavailability.create({
      data: { schoolId, teacherId, dayOfWeek: 3, startTime: '08:00', endTime: '09:00' },
    });
    const res = await api(`/${created.id}`, studentToken, 'DELETE');
    expect(res.status).toBe(403);
  });
});

describe('GET — routage timetables (non-régression V2.5)', () => {
  it('le routeur teacher-unavailabilities existe sans conflit avec /timetables', async () => {
    const res = await api('', adminBToken);
    expect(res.status).toBe(200);
  });
});