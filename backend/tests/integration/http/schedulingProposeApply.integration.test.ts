/**
 * Test d'intégration bout-en-bout — Scheduling Engine V2.5 (propose → apply).
 *
 * Couvre ce qu'aucun test unitaire ne peut prouver :
 *   1. La chaîne complète HTTP → use case → solveur CP-SAT réel → repository Prisma réel, avec
 *      les contraintes dures (type de salle) et souple (salle habituelle) vérifiées sur les
 *      TimetableSlot réellement écrits en base.
 *   2. L'ATOMICITÉ de apply-schedule : si une séance entre en conflit au moment d'écrire (état
 *      changé entre propose et apply), AUCUNE séance de la proposition n'est créée.
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
import type { SeanceProposee } from '@domain/ports/services/SchedulingSolverPort';

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET non défini — requis dans .env.test pour ce test.');
}

let server: Server;
let baseUrl: string;
let schoolId: string;
let adminToken: string;
let academicYearId: string;
let classId: string;
let timetableId: string;
let salleHabituelleId: string;
let salleLaboId: string;
let subjectMathsId: string;
let subjectTpId: string;
let teacherAId: string;
let teacherBId: string;

const headers = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'scheduling');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'sched-admin' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  academicYearId = annee.id;

  const classe = await prismaTest.class.create({
    data: { schoolId, academicYearId, name: '4e A', level: '4e', capacity: 40, status: 'ACTIVE' },
  });
  classId = classe.id;

  // Grille horaire minimale : 2 jours × 2 périodes de cours = 4 cases plaçables.
  await prismaTest.timetableGridConfig.create({
    data: {
      schoolId, heureDebut: '08:00', dureePeriode: 60,
      periodesAvantP1: 2, dureePetitePause: 0,
      periodesAvantP2: 0, dureeGrandePause: 0, periodesApresP2: 0,
      joursActifs: ['LUNDI', 'MARDI'],
    },
  });

  const salleHabituelle = await prismaTest.room.create({
    data: { schoolId, name: 'Salle 4A', type: 'NORMAL', capacity: 40 },
  });
  salleHabituelleId = salleHabituelle.id;
  const salleLabo = await prismaTest.room.create({
    data: { schoolId, name: 'Labo SVT', type: 'LABORATORY', capacity: 24 },
  });
  salleLaboId = salleLabo.id;

  await prismaTest.classRoomAssignment.create({
    data: { schoolId, classId, roomId: salleHabituelleId, academicYearId },
  });

  const maths = await prismaTest.subject.create({
    data: { schoolId, name: 'Mathématiques', subjectType: 'THEORETICAL' },
  });
  subjectMathsId = maths.id;
  const tp = await prismaTest.subject.create({
    data: { schoolId, name: 'SVT — Travaux pratiques', subjectType: 'PRACTICAL' },
  });
  subjectTpId = tp.id;

  const teacherA = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: 'sched-prof-a' });
  teacherAId = teacherA.id;
  const teacherB = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: 'sched-prof-b' });
  teacherBId = teacherB.id;

  await prismaTest.teachingAssignment.createMany({
    data: [
      { classId, subjectId: subjectMathsId, teacherId: teacherAId, schoolId, academicYearId },
      { classId, subjectId: subjectTpId, teacherId: teacherBId, schoolId, academicYearId },
    ],
  });

  const resEdt = await fetch(`${baseUrl}/timetables/generate-skeleton`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ classId }),
  });
  const bodyEdt = await resEdt.json() as { success: boolean; data?: { id: string } };
  if (!bodyEdt.success || !bodyEdt.data) throw new Error(`Échec création EDT : ${JSON.stringify(bodyEdt)}`);
  timetableId = bodyEdt.data.id;

  await prismaTest.timetableSlot.create({
    data: {
      timetableId,
      roomId: salleHabituelleId,
      dayOfWeek: 0,
      startTime: '08:00',
      endTime: '09:00',
      kind: 'CLASS',
    },
  });

  await prismaTest.timetableSlot.create({
    data: {
      timetableId,
      subjectId: subjectMathsId,
      teacherId: teacherAId,
      roomId: salleHabituelleId,
      dayOfWeek: 2,
      startTime: '10:00',
      endTime: '11:00',
      kind: 'CLASS',
    },
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.timetableSlot.deleteMany({ where: { timetable: { schoolId } } });
  await prismaTest.timetable.deleteMany({ where: { schoolId } });
  await prismaTest.teachingAssignment.deleteMany({ where: { schoolId } });
  await prismaTest.classRoomAssignment.deleteMany({ where: { schoolId } });
  await prismaTest.timetableGridConfig.deleteMany({ where: { schoolId } });
  await prismaTest.room.deleteMany({ where: { schoolId } });
  await prismaTest.subject.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

async function proposer(contraintes?: unknown) {
  const res = await fetch(`${baseUrl}/timetables/${timetableId}/propose-schedule`, {
    method: 'POST', headers: headers(),
    body: contraintes !== undefined ? JSON.stringify({ contraintes }) : undefined,
  });
  const body = await res.json() as {
    success: boolean; message?: string; details?: unknown;
    data?: { statut: string; seances: SeanceProposee[]; scoreObjectif: number; dureeResolutionMs: number };
  };
  return { res, body };
}

async function appliquer(seances: SeanceProposee[]) {
  const res = await fetch(`${baseUrl}/timetables/${timetableId}/apply-schedule`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ seances }),
  });
  const body = await res.json() as { success: boolean; message?: string; code?: string; data?: { creneauxCrees: number } };
  return { res, body };
}

async function simuler(simulations: unknown) {
  const res = await fetch(`${baseUrl}/timetables/${timetableId}/what-if`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ simulations }),
  });
  const body = await res.json() as {
    success: boolean; message?: string; details?: unknown;
    data?: { differences: { seancesDeplacees: number; scoreBase: number; scoreSimule: number } };
  };
  return { res, body };
}

describe('Scheduling Engine V2.5 — propose puis apply', () => {
  it('propose-schedule respecte le type de salle (dur) et préfère la salle habituelle (souple), sans rien écrire', async () => {
    const { res, body } = await proposer();
    if (!body.success) throw new Error(`Échec proposition : ${JSON.stringify(body)}`);
    expect(res.status).toBe(200);
    expect(['OPTIMAL', 'FEASIBLE']).toContain(body.data!.statut);
    // 2 matières × hoursPerWeek=2 (défaut) / cases d'1 h = 2 séances chacune → 4 au total.
    expect(body.data!.seances).toHaveLength(4);

    const seanceMaths = body.data!.seances.find(s => s.subjectId === subjectMathsId)!;
    const seanceTp = body.data!.seances.find(s => s.subjectId === subjectTpId)!;

    // DUR — la matière PRACTICAL va en laboratoire, jamais en salle normale.
    expect(seanceTp.roomId).toBe(salleLaboId);
    // SOUPLE — la matière théorique prend la salle habituelle de la classe.
    expect(seanceMaths.roomId).toBe(salleHabituelleId);

    // Le solveur ne persiste RIEN : le squelette, y compris sa ligne vide avec salle, et le créneau rempli restent inchangés.
    const slots = await prismaTest.timetableSlot.findMany({ where: { timetableId } });
    expect(slots).toHaveLength(6);
    expect(slots.find(s => s.subjectId === null && s.teacherId === null)!.managedBySolver).toBe(false);
  });

  it('apply-schedule écrit réellement les créneaux de la proposition confirmée', async () => {
    const { body } = await proposer();
    const seances = body.data!.seances;

    const { res, body: bodyApply } = await appliquer(seances);
    if (!bodyApply.success) throw new Error(`Échec application : ${JSON.stringify(bodyApply)}`);
    expect(res.status).toBe(201);
    expect(bodyApply.data!.creneauxCrees).toBe(4);

    const slots = await prismaTest.timetableSlot.findMany({ where: { timetableId } });
    expect(slots).toHaveLength(5);
    expect(slots.some(s => s.subjectId === null && s.teacherId === null && s.roomId !== null)).toBe(false);
    expect(slots.find(s => s.subjectId === subjectTpId)!.roomId).toBe(salleLaboId);
    expect(slots.filter(s => (s.subjectId === subjectMathsId || s.subjectId === subjectTpId) && s.dayOfWeek < 2).every(s => s.managedBySolver)).toBe(true);
    expect(slots.find(s => s.subjectId === subjectMathsId && s.dayOfWeek === 2)!.id).toBeDefined();
    expect(slots.filter(s => s.dayOfWeek === 0 || s.dayOfWeek === 1)).toHaveLength(4);

    await prismaTest.timetableSlot.deleteMany({ where: { timetableId, subjectId: { not: null } } });
    await prismaTest.timetableSlot.create({
      data: {
        timetableId,
        subjectId: subjectMathsId,
        teacherId: teacherAId,
        roomId: salleHabituelleId,
        dayOfWeek: 2,
        startTime: '10:00',
        endTime: '11:00',
        kind: 'CLASS',
      },
    });
  });

  it("ATOMICITÉ — un conflit sur une seule séance annule TOUTE la proposition", async () => {
    const { body } = await proposer();
    const seances = body.data!.seances;
    expect(seances.length).toBe(4);

    // Simule un changement d'état entre propose et apply : un autre EDT occupe la salle de la
    // DERNIÈRE séance de la proposition. La 1re séance passerait sans problème — c'est
    // exactement ce qu'on veut voir annulé aussi.
    const autreClasse = await prismaTest.class.create({
      data: { schoolId, academicYearId, name: 'Classe concurrente', level: '4e', capacity: 40, status: 'ACTIVE' },
    });
    const autreEdt = await prismaTest.timetable.create({
      data: { schoolId, classId: autreClasse.id, academicYearId },
    });
    const derniere = seances[seances.length - 1]!;
    await prismaTest.timetableSlot.create({
      data: {
        timetableId: autreEdt.id,
        subjectId: derniere.subjectId,
        roomId: derniere.roomId,
        dayOfWeek: derniere.dayOfWeek,
        startTime: derniere.startTime,
        endTime: derniere.endTime,
        kind: 'CLASS',
      },
    });

    const { res, body: bodyApply } = await appliquer(seances);

    expect(res.status).toBe(409);
    expect(bodyApply.success).toBe(false);
    expect(bodyApply.code).toBe('CONFLIT_SALLE');

    // LE POINT CENTRAL : aucune séance écrite et seul le créneau rempli antérieur reste en base.
    const slots = await prismaTest.timetableSlot.count({ where: { timetableId } });
    expect(slots).toBe(1);

    await prismaTest.timetableSlot.deleteMany({ where: { timetableId: autreEdt.id } });
    await prismaTest.timetable.delete({ where: { id: autreEdt.id } });
    await prismaTest.class.delete({ where: { id: autreClasse.id } });
  });

  it('apply-schedule rejette des occurrences non contiguës avant toute écriture (422)', async () => {
    await prismaTest.timetableGridConfig.update({
      where: { schoolId },
      data: { periodesAvantP1: 3 },
    });

    try {
      const { res, body } = await appliquer([
        { subjectId: subjectMathsId, teacherId: teacherAId, roomId: salleHabituelleId, dayOfWeek: 0, startTime: '08:00', endTime: '09:00' },
        { subjectId: subjectTpId, teacherId: teacherBId, roomId: salleLaboId, dayOfWeek: 0, startTime: '09:00', endTime: '10:00' },
        { subjectId: subjectMathsId, teacherId: teacherAId, roomId: salleHabituelleId, dayOfWeek: 0, startTime: '10:00', endTime: '11:00' },
        { subjectId: subjectTpId, teacherId: teacherBId, roomId: salleLaboId, dayOfWeek: 1, startTime: '08:00', endTime: '09:00' },
      ]);

      expect(res.status).toBe(422);
      expect(body.success).toBe(false);
      expect(body.message).toContain('ne sont pas contiguës');
      expect(await prismaTest.timetableSlot.count({ where: { timetableId } })).toBe(1);
    } finally {
      await prismaTest.timetableGridConfig.update({
        where: { schoolId },
        data: { periodesAvantP1: 2 },
      });
    }
  });

  it('apply-schedule rejette une proposition vide (422)', async () => {
    const { res, body } = await appliquer([]);
    expect(res.status).toBe(422);
    expect(body.success).toBe(false);
  });

  it('propose-schedule accepte des contraintes douces valides (200)', async () => {
    const { res, body } = await proposer({ trouEnseignant: true, volumeMaxEnseignantParJour: 240 });
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(['OPTIMAL', 'FEASIBLE']).toContain(body.data!.statut);
  });

  it('propose-schedule rejette une clé de contrainte inconnue (400)', async () => {
    const { res, body } = await proposer({ optionInconnue: true });
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('propose-schedule rejette un type de contrainte invalide (400)', async () => {
    const { res, body } = await proposer({ volumeMaxEnseignantParJour: 'beaucoup' });
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });

  it('what-if : simulation valide (aucune salle hors service) → 200, aucun déplacement', async () => {
    const { res, body } = await simuler({});
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data!.differences.seancesDeplacees).toBe(0);
  });

  it('what-if : simulation invalide (clé inconnue) → 400', async () => {
    const { res, body } = await simuler({ inconnu: true });
    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
  });
});
