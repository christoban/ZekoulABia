/**
 * Test d'intégration — conflit de salle sur POST /timetables/:id/slots (V2.3).
 *
 * Vérifie que la requête de conflit construite pour Room (TimetableRepository.
 * findCreneauxSalleParJour, consommée aujourd'hui par la saisie manuelle et plus tard par le
 * Scheduling Engine V2.5) bloque réellement deux créneaux qui se chevauchent dans la même salle,
 * contre la vraie base de test — pas seulement au niveau unitaire avec des doubles en mémoire.
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
let classIdA: string;
let classIdB: string;
let roomId: string;
let academicYearId: string;

const headers = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'timetableRoomConflict');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'room-conflict-admin' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  academicYearId = annee.id;
  const classeA = await prismaTest.class.create({
    data: { schoolId, academicYearId: annee.id, name: '3e A', level: '3e', capacity: 40, status: 'ACTIVE' },
  });
  classIdA = classeA.id;
  const classeB = await prismaTest.class.create({
    data: { schoolId, academicYearId: annee.id, name: '3e B', level: '3e', capacity: 40, status: 'ACTIVE' },
  });
  classIdB = classeB.id;

  const room = await prismaTest.room.create({
    data: { schoolId, name: 'Labo Physique', type: 'LABORATORY', capacity: 24 },
  });
  roomId = room.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.timetableSlot.deleteMany({ where: { timetable: { schoolId } } });
  await prismaTest.timetable.deleteMany({ where: { schoolId } });
  await prismaTest.room.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

async function creerEdt(classId: string): Promise<string> {
  const res = await fetch(`${baseUrl}/timetables/manual`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ classId, academicYearId }),
  });
  const body = await res.json() as { success: boolean; data?: { timetableId: string } };
  if (!body.success || !body.data) throw new Error(`Échec création EDT : ${JSON.stringify(body)}`);
  return body.data.timetableId;
}

async function ajouterSlot(timetableId: string, overrides: Record<string, unknown> = {}) {
  return fetch(`${baseUrl}/timetables/${timetableId}/slots`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      dayOfWeek: 0,
      startTime: '08:00',
      endTime: '09:00',
      kind: 'CLASS',
      roomId,
      ...overrides,
    }),
  });
}

describe('Conflit de salle — POST /timetables/:id/slots', () => {
  it('refuse (409 CONFLIT_SALLE) un 2e créneau qui chevauche dans la même salle, même sur une autre classe', async () => {
    const edtA = await creerEdt(classIdA);
    const edtB = await creerEdt(classIdB);

    const premier = await ajouterSlot(edtA);
    expect(premier.status).toBe(201);

    const second = await ajouterSlot(edtB, { startTime: '08:30', endTime: '09:30' });
    const body = await second.json() as { success: boolean; code?: string; message?: string };
    expect(second.status).toBe(409);
    expect(body.code).toBe('CONFLIT_SALLE');
    expect(body.message).toContain('Labo Physique');
  });

  it('accepte deux créneaux qui se chevauchent dans des salles différentes', async () => {
    const autreRoom = await prismaTest.room.create({
      data: { schoolId, name: 'Salle 12', capacity: 40 },
    });

    const edtA = await creerEdt(classIdA);
    const edtB = await creerEdt(classIdB);

    const premier = await ajouterSlot(edtA, { dayOfWeek: 1 });
    expect(premier.status).toBe(201);

    const second = await ajouterSlot(edtB, { dayOfWeek: 1, roomId: autreRoom.id });
    expect(second.status).toBe(201);
  });
});
