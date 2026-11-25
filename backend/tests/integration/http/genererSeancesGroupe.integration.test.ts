/**
 * Test d'intégration bout-en-bout — POST /timetables/:id/generate-group-sessions.
 *
 * Classe avec élèves répartis sur 2 langues LV2 → génération groupée → vérifie que les 2
 * TimetableSlot sont créés, que la salle habituelle (ClassRoomAssignment) va au Group le plus
 * nombreux, que le plus petit va dans la salle flottante, et que les participants résolus par
 * créneau (GET /timetable-slots/:id/students) correspondent bien à chaque Group.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { bootstrapHexagonal } from '@infrastructure/config/hexagonal.bootstrap';
import { creerEleveAvecClasse } from '@application/shared/studentEnrollment';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

const enrollmentRepo = new PrismaEnrollmentRepository(prismaTest);

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET non défini — requis dans .env.test pour ce test.');
}

let server: Server;
let baseUrl: string;
let schoolId: string;
let adminToken: string;
let classId: string;
let timetableId: string;
let groupSetId: string;
let groupAllemandId: string;
let groupEspagnolId: string;
let salleHabituelleId: string;
let salleFlottanteId: string;
let teacherDeId: string;
let teacherEsId: string;
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

  const school = await creerEcoleTest(prismaTest, 'genererSeances');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'seances-admin' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  academicYearId = annee.id;
  const classe = await prismaTest.class.create({
    data: { schoolId, academicYearId: annee.id, name: '5e A', level: '5e', capacity: 40, status: 'ACTIVE' },
  });
  classId = classe.id;

  const salleHabituelle = await prismaTest.room.create({ data: { schoolId, name: 'Salle 5A', capacity: 40 } });
  salleHabituelleId = salleHabituelle.id;
  const salleFlottante = await prismaTest.room.create({ data: { schoolId, name: 'Flottante 10', capacity: 10 } });
  salleFlottanteId = salleFlottante.id;
  await prismaTest.classRoomAssignment.create({
    data: { schoolId, classId, roomId: salleHabituelleId, academicYearId: annee.id },
  });

  const subjectDe = await prismaTest.subject.create({ data: { schoolId, name: 'Allemand', isLV2: true } });
  const subjectEs = await prismaTest.subject.create({ data: { schoolId, name: 'Espagnol', isLV2: true } });

  const teacherDe = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: 'seances-teacher-de' });
  const teacherEs = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: 'seances-teacher-es' });
  teacherDeId = teacherDe.id;
  teacherEsId = teacherEs.id;

  const groupSet = await prismaTest.studentGroupSet.create({ data: { schoolId, code: 'LV2', name: 'LV2' } });
  groupSetId = groupSet.id;
  const groupAllemand = await prismaTest.studentGroup.create({
    data: { groupSetId, name: 'Allemand', subjectId: subjectDe.id },
  });
  groupAllemandId = groupAllemand.id;
  const groupEspagnol = await prismaTest.studentGroup.create({
    data: { groupSetId, name: 'Espagnol', subjectId: subjectEs.id },
  });
  groupEspagnolId = groupEspagnol.id;

  // 3 élèves en Allemand (le plus nombreux → salle habituelle), 2 en Espagnol (→ flottante).
  for (let i = 0; i < 3; i++) {
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: `seances-de-${i}` });
    const profile = await creerEleveAvecClasse(enrollmentRepo, { userId: student.id, classId, enrolledById: student.id });
    await prismaTest.studentGroupMembership.create({
      data: { studentProfileId: profile.id, groupId: groupAllemandId, groupSetId, academicYearId: annee.id },
    });
  }
  for (let i = 0; i < 2; i++) {
    const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: `seances-es-${i}` });
    const profile = await creerEleveAvecClasse(enrollmentRepo, { userId: student.id, classId, enrolledById: student.id });
    await prismaTest.studentGroupMembership.create({
      data: { studentProfileId: profile.id, groupId: groupEspagnolId, groupSetId, academicYearId: annee.id },
    });
  }

  const resEdt = await fetch(`${baseUrl}/timetables/manual`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ classId, academicYearId: annee.id }),
  });
  const bodyEdt = await resEdt.json() as { success: boolean; data?: { timetableId: string } };
  if (!bodyEdt.success || !bodyEdt.data) throw new Error(`Échec création EDT : ${JSON.stringify(bodyEdt)}`);
  timetableId = bodyEdt.data.timetableId;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.timetableSlot.deleteMany({ where: { timetable: { schoolId } } });
  await prismaTest.timetable.deleteMany({ where: { schoolId } });
  await prismaTest.studentGroupMembership.deleteMany({ where: { group: { groupSet: { schoolId } } } });
  await prismaTest.studentGroup.deleteMany({ where: { groupSet: { schoolId } } });
  await prismaTest.studentGroupSet.deleteMany({ where: { schoolId } });
  await prismaTest.classRoomAssignment.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.room.deleteMany({ where: { schoolId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.subject.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('POST /timetables/:id/generate-group-sessions', () => {
  it('crée une séance par Group, salle habituelle au plus nombreux, participants corrects', async () => {
    const res = await fetch(`${baseUrl}/timetables/${timetableId}/generate-group-sessions`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        groupSetId,
        academicYearId,
        dayOfWeek: 0,
        startTime: '08:00',
        endTime: '09:00',
        enseignantParGroupe: [
          { groupId: groupAllemandId, teacherId: teacherDeId },
          { groupId: groupEspagnolId, teacherId: teacherEsId },
        ],
      }),
    });
    const body = await res.json() as {
      success: boolean; message?: string;
      data?: { creneauxCrees: { groupId: string; creneauId: string; roomId: string; participantsCount: number }[] };
    };
    if (!body.success || !body.data) throw new Error(`Échec génération : ${JSON.stringify(body)}`);
    expect(res.status).toBe(201);
    expect(body.data.creneauxCrees).toHaveLength(2);

    const seanceAllemand = body.data.creneauxCrees.find(s => s.groupId === groupAllemandId)!;
    const seanceEspagnol = body.data.creneauxCrees.find(s => s.groupId === groupEspagnolId)!;

    expect(seanceAllemand.participantsCount).toBe(3);
    expect(seanceAllemand.roomId).toBe(salleHabituelleId);
    expect(seanceEspagnol.participantsCount).toBe(2);
    expect(seanceEspagnol.roomId).toBe(salleFlottanteId);

    // Participants résolus correctement par créneau via l'endpoint générique.
    const resParticipantsDe = await fetch(`${baseUrl}/timetable-slots/${seanceAllemand.creneauId}/students`, { headers: headers() });
    const bodyParticipantsDe = await resParticipantsDe.json() as { success: boolean; data?: { eleves: unknown[]; groupId: string | null } };
    expect(bodyParticipantsDe.data?.eleves).toHaveLength(3);
    expect(bodyParticipantsDe.data?.groupId).toBe(groupAllemandId);

    const resParticipantsEs = await fetch(`${baseUrl}/timetable-slots/${seanceEspagnol.creneauId}/students`, { headers: headers() });
    const bodyParticipantsEs = await resParticipantsEs.json() as { success: boolean; data?: { eleves: unknown[]; groupId: string | null } };
    expect(bodyParticipantsEs.data?.eleves).toHaveLength(2);
    expect(bodyParticipantsEs.data?.groupId).toBe(groupEspagnolId);
  });

  it('refuse un 2e appel pour le même créneau (idempotence)', async () => {
    const res = await fetch(`${baseUrl}/timetables/${timetableId}/generate-group-sessions`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        groupSetId, academicYearId, dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
        enseignantParGroupe: [
          { groupId: groupAllemandId, teacherId: teacherDeId },
          { groupId: groupEspagnolId, teacherId: teacherEsId },
        ],
      }),
    });
    const body = await res.json() as { success: boolean; message?: string };
    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    expect(body.message).toContain('existent déjà');
  });
});
