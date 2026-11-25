import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import cookieParser from 'cookie-parser';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';
import { prismaTest } from '../../helpers/prismaTestClient.ts';

if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET requis');

let server: Server;
let baseUrl: string;
let schoolId: string;
let adminToken: string;
let staffToken: string;
let academicYearId: string;
let timetableId: string;
let slotId: string;
let secondTimetableId: string;

const headers = (token: string) => ({ Cookie: `access_token=${token}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'edt-workflow');
  schoolId = school.id;
  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'edt-workflow-admin' });
  const staff = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STAFF', suffix: 'edt-workflow-staff' });
  adminToken = jwt.sign({ userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' }, process.env.JWT_SECRET!);
  staffToken = jwt.sign({ userId: staff.id, schoolId, role: 'STAFF', permissions: ['MANAGE_TIMETABLE'], tokenType: 'access' }, process.env.JWT_SECRET!);

  const year = await prismaTest.academicYear.create({
    data: { schoolId, name: '2026-2027', startDate: new Date('2026-09-01'), endDate: new Date('2027-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  academicYearId = year.id;
  const classe = await prismaTest.class.create({ data: { schoolId, academicYearId, name: '4e A', level: '4e', capacity: 40, status: 'ACTIVE' } });
  const autreClasse = await prismaTest.class.create({ data: { schoolId, academicYearId, name: '4e B', level: '4e', capacity: 40, status: 'ACTIVE' } });
  const edt = await prismaTest.timetable.create({ data: { schoolId, classId: classe.id, academicYearId, status: 'SUBMITTED' } });
  timetableId = edt.id;
  const slot = await prismaTest.timetableSlot.create({ data: { timetableId, dayOfWeek: 0, startTime: '08:00', endTime: '09:00' } });
  slotId = slot.id;
  const second = await prismaTest.timetable.create({ data: { schoolId, classId: autreClasse.id, academicYearId, status: 'DRAFT' } });
  secondTimetableId = second.id;
  await prismaTest.timetableSlot.create({ data: { timetableId: second.id, dayOfWeek: 0, startTime: '08:00', endTime: '09:00' } });
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  await prismaTest.activitiesLog.deleteMany({ where: { schoolId } });
  await prismaTest.timetableSlot.deleteMany({ where: { timetable: { schoolId } } });
  await prismaTest.timetable.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('Workflow HTTP EDT', () => {
  it('applique le cycle DRAFT → SUBMITTED → PUBLISHED avec séparation RBAC', async () => {
    const staffSubmit = await fetch(`${baseUrl}/timetables/${secondTimetableId}/submit`, { method: 'POST', headers: headers(staffToken) });
    expect(staffSubmit.status).toBe(200);
    expect((await prismaTest.timetable.findUnique({ where: { id: secondTimetableId } }))?.status).toBe('SUBMITTED');

    const staffPublish = await fetch(`${baseUrl}/timetables/${timetableId}/publish`, { method: 'PUT', headers: headers(staffToken) });
    expect(staffPublish.status).toBe(403);
    const staffPublishAll = await fetch(`${baseUrl}/timetables/publish-all`, { method: 'PUT', headers: headers(staffToken) });
    expect(staffPublishAll.status).toBe(403);
    const staffReopen = await fetch(`${baseUrl}/timetables/${timetableId}/reopen`, { method: 'PUT', headers: headers(staffToken) });
    expect(staffReopen.status).toBe(403);

    const adminPublish = await fetch(`${baseUrl}/timetables/${timetableId}/publish`, { method: 'PUT', headers: headers(adminToken) });
    expect(adminPublish.status).toBe(200);
    expect((await prismaTest.timetable.findUnique({ where: { id: timetableId } }))?.status).toBe('PUBLISHED');

    const modifyPublished = await fetch(`${baseUrl}/timetables/${timetableId}/slots/${slotId}`, {
      method: 'PUT', headers: headers(staffToken), body: JSON.stringify({ startTime: '09:30', endTime: '10:30' }),
    });
    expect(modifyPublished.status).toBe(422);

    const adminReopen = await fetch(`${baseUrl}/timetables/${timetableId}/reopen`, { method: 'PUT', headers: headers(adminToken) });
    expect(adminReopen.status).toBe(200);
    expect((await prismaTest.timetable.findUnique({ where: { id: timetableId } }))?.status).toBe('DRAFT');
  });

  it('refuse à l’Admin les actions techniques de préparation', async () => {
    const response = await fetch(`${baseUrl}/timetables/${timetableId}/propose-schedule`, {
      method: 'POST', headers: headers(adminToken),
    });
    expect(response.status).toBe(403);
  });

  it('publie tous les EDT en attente et refuse un lot vide', async () => {
    const publishAll = await fetch(`${baseUrl}/timetables/publish-all`, { method: 'PUT', headers: headers(adminToken) });
    const body = await publishAll.json() as { data?: { publies: number; timetableIds: string[] } };
    expect(publishAll.status).toBe(200);
    expect(body.data).toEqual({ publies: 1, timetableIds: [secondTimetableId] });
    expect((await prismaTest.timetable.findUnique({ where: { id: secondTimetableId } }))?.status).toBe('PUBLISHED');

    const repeated = await fetch(`${baseUrl}/timetables/publish-all`, { method: 'PUT', headers: headers(adminToken) });
    expect(repeated.status).toBe(409);
  });
});
