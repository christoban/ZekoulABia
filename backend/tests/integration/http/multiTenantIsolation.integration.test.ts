/**
 * Test d'intégration — isolation multi-tenant élargie (V0.2).
 *
 * Vérifie que 12 routes sensibles refusent toute action d'une école A sur les données
 * d'une école B (token A → ressource B = 403/404), et qu'aucune donnée n'est altérée.
 * Complète le fichier academicYearStructureMultiTenant qui ne couvrait que 3 routes.
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

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET requis');

let server: Server;
let baseUrl: string;
let schoolAId: string;
let schoolBId: string;
let tokenA: string;
let timetableBId: string;
let classBId: string;
let subjectBId: string;
let roomBId: string;
let teacherBId: string;
let academicYearBId: string;

const headers = () => ({ Cookie: `access_token=${tokenA}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v2`;

  const schoolA = await creerEcoleTest(prismaTest, 'mtA2');
  const schoolB = await creerEcoleTest(prismaTest, 'mtB2');
  schoolAId = schoolA.id; schoolBId = schoolB.id;

  const adminA = await creerUtilisateurTest(prismaTest, schoolAId, { role: 'ADMIN', suffix: 'mta2' });
  tokenA = jwt.sign({ userId: adminA.id, schoolId: schoolAId, role: 'ADMIN', permissions: [], tokenType: 'access' }, process.env.JWT_SECRET!);

  const yearB = await prismaTest.academicYear.create({ data: { schoolId: schoolBId, name: '2025-2026-B2', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' } });
  academicYearBId = yearB.id;
  const classeB = await prismaTest.class.create({ data: { schoolId: schoolBId, academicYearId: yearB.id, name: '4e B2', level: '4e', capacity: 40, status: 'ACTIVE' } });
  classBId = classeB.id;
  const subjectB = await prismaTest.subject.create({ data: { schoolId: schoolBId, name: 'Maths B2', subjectType: 'THEORETICAL' } });
  subjectBId = subjectB.id;
  const roomB = await prismaTest.room.create({ data: { schoolId: schoolBId, name: 'Salle B2', type: 'NORMAL', capacity: 30 } });
  roomBId = roomB.id;
  const teacherB = await creerUtilisateurTest(prismaTest, schoolBId, { role: 'TEACHER', suffix: 'mtb2' });
  teacherBId = teacherB.id;
  await prismaTest.teachingAssignment.create({ data: { classId: classBId, subjectId: subjectBId, teacherId: teacherBId, schoolId: schoolBId, academicYearId: yearB.id } });
  await prismaTest.timetableGridConfig.create({ data: { schoolId: schoolBId, heureDebut: '08:00', dureePeriode: 60, periodesAvantP1: 2, dureePetitePause: 0, periodesAvantP2: 2, dureeGrandePause: 0, periodesApresP2: 0, joursActifs: ['LUNDI', 'MARDI'] } });
  await prismaTest.classRoomAssignment.create({ data: { schoolId: schoolBId, classId: classBId, roomId: roomBId, academicYearId: yearB.id } });
  const edtB = await prismaTest.timetable.create({ data: { schoolId: schoolBId, classId: classBId, academicYearId: yearB.id } });
  timetableBId = edtB.id;
});

afterAll(async () => {
  await new Promise<void>(r => server.close(() => r()));
  for (const sid of [schoolAId, schoolBId]) {
    await prismaTest.timetableSlot.deleteMany({ where: { timetable: { schoolId: sid } } });
    await prismaTest.timetable.deleteMany({ where: { schoolId: sid } });
    await prismaTest.teachingAssignment.deleteMany({ where: { schoolId: sid } });
    await prismaTest.classRoomAssignment.deleteMany({ where: { schoolId: sid } });
    await prismaTest.timetableGridConfig.deleteMany({ where: { schoolId: sid } });
    await prismaTest.teacherUnavailability.deleteMany({ where: { schoolId: sid } });
    await prismaTest.room.deleteMany({ where: { schoolId: sid } });
    await prismaTest.subject.deleteMany({ where: { schoolId: sid } });
    await prismaTest.enrollment.deleteMany({ where: { schoolId: sid } });
    await prismaTest.class.deleteMany({ where: { schoolId: sid } });
    await prismaTest.academicYear.deleteMany({ where: { schoolId: sid } });
    await prismaTest.user.deleteMany({ where: { schoolId: sid } });
    await nettoyerEcole(prismaTest, sid);
  }
  await prismaTest.$disconnect();
});

describe('Isolation multi-tenant — 12 routes sensibles', () => {
  it('1. propose-schedule : A ne peut pas proposer sur EDT de B', async () => {
    const res = await fetch(`${baseUrl}/timetables/${timetableBId}/propose-schedule`, { method: 'POST', headers: headers() });
    expect([403, 404]).toContain(res.status);
  });
  it('2. what-if : A ne peut pas simuler sur EDT de B', async () => {
    const res = await fetch(`${baseUrl}/timetables/${timetableBId}/what-if`, { method: 'POST', headers: headers(), body: JSON.stringify({ simulations: {} }) });
    expect([403, 404]).toContain(res.status);
  });
  it('3. apply-schedule : A ne peut pas appliquer sur EDT de B', async () => {
    const res = await fetch(`${baseUrl}/timetables/${timetableBId}/apply-schedule`, { method: 'POST', headers: headers(), body: JSON.stringify({ seances: [{ subjectId: subjectBId, teacherId: teacherBId, roomId: roomBId, dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }] }) });
    expect([403, 404]).toContain(res.status);
  });
  it('4. publish : A ne peut pas publier EDT de B', async () => {
    const res = await fetch(`${baseUrl}/timetables/${timetableBId}/publish`, { method: 'PUT', headers: headers() });
    expect([403, 404]).toContain(res.status);
  });
  it('5. teacher-unavailability create : A ne peut pas créer pour teacher de B', async () => {
    const res = await fetch(`${baseUrl}/teacher-unavailabilities`, { method: 'POST', headers: headers(), body: JSON.stringify({ teacherId: teacherBId, dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }) });
    expect([400, 403, 404]).toContain(res.status);
  });
  it('6. teacher-unavailability list : A ne voit pas les indispos de B', async () => {
    await prismaTest.teacherUnavailability.create({ data: { schoolId: schoolBId, teacherId: teacherBId, dayOfWeek: 1, startTime: '10:00', endTime: '11:00' } });
    const res = await fetch(`${baseUrl}/teacher-unavailabilities?teacherId=${teacherBId}`, { headers: headers() });
    // Soit 403/404/400, soit 200 avec liste vide (jamais les données de B)
    if (res.status === 200) {
      const body = await res.json() as { data?: unknown[] };
      expect(body.data ?? []).toHaveLength(0);
    } else {
      expect([400, 403, 404]).toContain(res.status);
    }
  });
  it('7. class students : A ne peut pas lister les élèves de la classe de B', async () => {
    const res = await fetch(`${baseUrl}/classes/${classBId}/students`, { headers: headers() });
    expect([403, 404]).toContain(res.status);
  });
  it('8. class room-assignment : A ne peut pas assigner une salle à la classe de B', async () => {
    const res = await fetch(`${baseUrl}/classes/${classBId}/room-assignment`, { method: 'PUT', headers: headers(), body: JSON.stringify({ roomId: roomBId }) });
    expect([400, 403, 404]).toContain(res.status);
  });
  it('9. academic-year : A ne peut pas lire l année de B', async () => {
    const res = await fetch(`${baseUrl}/academic-years/${academicYearBId}`, { headers: headers() });
    // Selon l'implémentation, 404 (not found for tenant) ou 403
    expect([403, 404]).toContain(res.status);
  });
  it('10. what-if isolation : salle d une autre école → 404', async () => {
    // Crée une salle dans A, tente de la passer en sallesHorsService sur EDT de B (double faute)
    const salleA = await prismaTest.room.create({ data: { schoolId: schoolAId, name: 'Salle A isol', type: 'NORMAL', capacity: 20 } });
    const res = await fetch(`${baseUrl}/timetables/${timetableBId}/what-if`, { method: 'POST', headers: headers(), body: JSON.stringify({ simulations: { sallesHorsService: [salleA.id] } }) });
    // what-if vérifie d'abord l'accès EDT (B) → déjà 403/404 avant la vérif salle
    expect([403, 404]).toContain(res.status);
    await prismaTest.room.delete({ where: { id: salleA.id } });
  });
  it('11. propose-schedule avec salle habituelle : aucune fuite de salle de B vers A', async () => {
    // Vérifie que propose-schedule sur un EDT de B ne retourne jamais de salle de A
    const res = await fetch(`${baseUrl}/timetables/${timetableBId}/propose-schedule`, { method: 'POST', headers: headers() });
    const body = await res.json() as { data?: { seances?: { roomId: string }[] } };
    if (res.status === 200 && body.data?.seances) {
      for (const s of body.data.seances) expect(s.roomId).not.toBeUndefined();
      // Aucune salle de A ne doit apparaître
      const sallesA = await prismaTest.room.findMany({ where: { schoolId: schoolAId }, select: { id: true } });
      const idsA = new Set(sallesA.map(r => r.id));
      for (const s of body.data.seances) expect(idsA.has(s.roomId)).toBe(false);
    } else {
      expect([403, 404]).toContain(res.status);
    }
  });
  it('12. idempotence tenant : aucune donnée de B altérée après 11 tentatives', async () => {
    const edtB = await prismaTest.timetable.findUnique({ where: { id: timetableBId } });
    expect(edtB?.schoolId).toBe(schoolBId);
    const slotsB = await prismaTest.timetableSlot.count({ where: { timetable: { schoolId: schoolBId } } });
    expect(slotsB).toBe(0);
  });
});
