/**
 * Test d'intégration — V1.10 Communication (babillard + messagerie).
 *
 * Modules fonctionnels mais sans aucun test backend. Vérifie sur la vraie base :
 *  - Annonces : création RBAC (STAFF/ADMIN seulement), validations (titre/contenu/
 *    cibles/expiration), ciblage par rôle.
 *  - Messagerie : règles d'accès strictes (MessagerieAccessHelpers) — un élève ne peut
 *    écrire qu'à ses enseignants/staff, jamais à un autre élève ; pas d'auto-message ;
 *    accès à une conversation privée réservé aux participants ; idempotence par
 *    clientMessageId (offline-first) ; modération PENDING si messageModeration activée.
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
let staffToken: string;
let teacherToken: string;
let studentToken: string;
let staffId: string;
let teacherId: string;
let studentId: string;
let classId: string;
let autreEleveId: string;

const headers = (token: string) => ({ Cookie: `access_token=${token}`, 'Content-Type': 'application/json' });
const signer = (userId: string, role: string) =>
  jwt.sign({ userId, schoolId, role, permissions: [], tokenType: 'access' }, process.env.JWT_SECRET!);

async function creerEleveActifClasse(): Promise<string> {
  const eleve = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
  const profile = await prismaTest.studentProfile.create({ data: { userId: eleve.id, schoolId } });
  await prismaTest.enrollment.create({
    data: {
      studentId: profile.id,
      classId,
      academicYearId: (await prismaTest.academicYear.findFirst({ where: { schoolId } }))!.id,
      schoolId,
      enrolledById: staffId,
      status: 'ACTIVE',
    },
  });
  return eleve.id;
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'communicationV110');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = signer(admin.id, 'ADMIN');
  const staff = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STAFF' });
  staffToken = signer(staff.id, 'STAFF');
  staffId = staff.id;
  const teacher = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER' });
  teacherToken = signer(teacher.id, 'TEACHER');
  teacherId = teacher.id;
  await prismaTest.teacherProfile.create({ data: { userId: teacher.id } });
  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
  studentToken = signer(student.id, 'STUDENT');
  studentId = student.id;

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026 V1.10', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  const classe = await prismaTest.class.create({
    data: { name: 'Classe V1.10', schoolId, academicYearId: annee.id, professorPrincipalId: teacherId },
  });
  classId = classe.id;

  // Rattachement du staff pour l'enrôleur (enrollment.enrolledById)
  await prismaTest.staffProfile.create({ data: { userId: staffId, schoolId, title: 'Intendant' } });

  // L'élève principal est inscrit dans la classe (sinon destinatairesAutorises ne le
  // rattache à aucun enseignant)
  const studentProfile = await prismaTest.studentProfile.create({ data: { userId: studentId, schoolId } });
  await prismaTest.enrollment.create({
    data: {
      studentId: studentProfile.id,
      classId,
      academicYearId: annee.id,
      schoolId,
      enrolledById: staffId,
      status: 'ACTIVE',
    },
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await new Promise((r) => setTimeout(r, 500));
  await prismaTest.aIActionAuditLog.deleteMany({ where: { schoolId } });
  await prismaTest.notification.deleteMany({ where: { schoolId } });
  await prismaTest.messageReadStatus.deleteMany({ where: { message: { conversation: { schoolId } } } });
  await prismaTest.message.deleteMany({ where: { conversation: { schoolId } } });
  await prismaTest.conversationParticipant.deleteMany({ where: { conversation: { schoolId } } });
  await prismaTest.conversation.deleteMany({ where: { schoolId } });
  await prismaTest.announcement.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.staffProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('V1.10 — Annonces (babillard)', () => {
  it('STAFF peut créer une annonce ciblée et elle est persistée avec les bons rôles', async () => {
    const res = await fetch(`${baseUrl}/announcements`, {
      method: 'POST',
      headers: headers(staffToken),
      body: JSON.stringify({ title: 'Réunion parents', content: 'Réunion samedi 9h.', targetRoles: ['PARENT', 'TEACHER'], isPinned: true }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { id: string; targetRoles: string[]; isPinned: boolean } };
    expect(body.data.targetRoles).toContain('PARENT');
    expect(body.data.isPinned).toBe(true);

    const reloaded = await prismaTest.announcement.findUnique({ where: { id: body.data.id } });
    expect(reloaded?.title).toBe('Réunion parents');
  });

  it('refuse une annonce sans titre, sans contenu ou sans rôles cibles', async () => {
    const cas = [
      { title: '', content: 'x', targetRoles: ['PARENT'] },
      { title: 't', content: '  ', targetRoles: ['PARENT'] },
      { title: 't', content: 'x', targetRoles: [] },
    ];
    for (const payload of cas) {
      const res = await fetch(`${baseUrl}/announcements`, { method: 'POST', headers: headers(staffToken), body: JSON.stringify(payload) });
      expect(res.status).toBe(400);
    }
  });

  it('refuse une annonce avec expiration dans le passé', async () => {
    const res = await fetch(`${baseUrl}/announcements`, {
      method: 'POST',
      headers: headers(staffToken),
      body: JSON.stringify({ title: 't', content: 'c', targetRoles: ['TEACHER'], expiresAt: '2020-01-01T00:00:00Z' }),
    });
    expect(res.status).toBe(400);
  });

  it('RBAC — un élève ne peut pas créer d\'annonce', async () => {
    const res = await fetch(`${baseUrl}/announcements`, {
      method: 'POST',
      headers: headers(studentToken),
      body: JSON.stringify({ title: 't', content: 'c', targetRoles: ['STUDENT'] }),
    });
    expect(res.status).toBe(403);
  });

  it('un élève peut lister les annonces qui le ciblent', async () => {
    await fetch(`${baseUrl}/announcements`, {
      method: 'POST',
      headers: headers(staffToken),
      body: JSON.stringify({ title: 'Info élèves', content: 'Vacances', targetRoles: ['STUDENT'] }),
    });
    const res = await fetch(`${baseUrl}/announcements`, { method: 'GET', headers: headers(studentToken) });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ title: string }> };
    expect(body.data.some((a) => a.title === 'Info élèves')).toBe(true);
  });
});

describe('V1.10 — Messagerie (règles d\'accès + idempotence)', () => {
  it('un élève peut écrire à son enseignant (destinataire autorisé)', async () => {
    const res = await fetch(`${baseUrl}/messagerie/messages`, {
      method: 'POST',
      headers: headers(studentToken),
      body: JSON.stringify({ content: 'Question sur le cours', destinataireId: teacherId, clientMessageId: `msg-${Date.now()}` }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { conversationId: string } };
    expect(body.data.conversationId).toBeDefined();
  });

  it('ARGENT/règles — un élève ne peut pas écrire à un AUTRE élève', async () => {
    autreEleveId = await creerEleveActifClasse();
    const res = await fetch(`${baseUrl}/messagerie/messages`, {
      method: 'POST',
      headers: headers(studentToken),
      body: JSON.stringify({ content: 'hey', destinataireId: autreEleveId, clientMessageId: `msg-${Date.now()}` }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { message: string };
    expect(body.message).toContain('écrire à ce destinataire');
  });

  it('refuse de s\'écrire à soi-même', async () => {
    const res = await fetch(`${baseUrl}/messagerie/messages`, {
      method: 'POST',
      headers: headers(studentToken),
      body: JSON.stringify({ content: 'coucou', destinataireId: studentId, clientMessageId: `msg-${Date.now()}` }),
    });
    expect(res.status).toBe(400);
  });

  it('refuse un message vide ou sans clientMessageId', async () => {
    for (const payload of [{ content: '  ', destinataireId: teacherId, clientMessageId: 'x' }, { content: 'coucou', destinataireId: teacherId, clientMessageId: '' }]) {
      const res = await fetch(`${baseUrl}/messagerie/messages`, { method: 'POST', headers: headers(studentToken), body: JSON.stringify(payload) });
      expect(res.status).toBe(400);
    }
  });

  it('IDEMPOTENCE — rejouer le même clientMessageId ne crée pas de doublon', async () => {
    const clientMessageId = `idem-${Date.now()}`;
    const first = await fetch(`${baseUrl}/messagerie/messages`, {
      method: 'POST',
      headers: headers(staffToken),
      body: JSON.stringify({ content: 'Message idempotent', destinataireId: teacherId, clientMessageId }),
    });
    const firstBody = await first.json() as { data: { id: string } };
    expect(first.status).toBe(201);

    const second = await fetch(`${baseUrl}/messagerie/messages`, {
      method: 'POST',
      headers: headers(staffToken),
      body: JSON.stringify({ content: 'Message idempotent', destinataireId: teacherId, clientMessageId }),
    });
    const secondBody = await second.json() as { data: { id: string } };
    expect(second.status).toBe(201);
    expect(secondBody.data.id).toBe(firstBody.data.id);

    const count = await prismaTest.message.count({ where: { id: clientMessageId } });
    expect(count).toBe(1);
  });

  it('ACCÈS — un élève ne peut pas lire une conversation privée dont il n\'est pas participant', async () => {
    // Conversation privée entre staff et enseignant
    const conversation = await prismaTest.conversation.create({
      data: { schoolId, type: 'PRIVATE', participants: { create: [{ userId: staffId }, { userId: teacherId }] } },
    });
    const res = await fetch(`${baseUrl}/messagerie/conversations/${conversation.id}/messages`, {
      method: 'GET',
      headers: headers(studentToken),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { message: string };
    expect(body.message).toContain('ne faites pas partie');
  });

  it('MODÉRATION — message en canal de classe passée en PENDING quand messageModeration est active', async () => {
    // Réutilise la classe principale (professorPrincipalId = teacher, unique)
    const conversation = await prismaTest.conversation.create({
      data: { schoolId, type: 'CLASS_CHANNEL', classId },
    });
    await prismaTest.schoolConfig.upsert({
      where: { schoolId },
      update: { messageModeration: true },
      create: { schoolId, messageModeration: true },
    });

    const res = await fetch(`${baseUrl}/messagerie/messages`, {
      method: 'POST',
      headers: headers(teacherToken),
      body: JSON.stringify({ content: 'Message à modérer', conversationId: conversation.id, clientMessageId: `mod-${Date.now()}` }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { moderationStatus: string } };
    expect(body.data.moderationStatus).toBe('PENDING');

    // Remettre la config par défaut pour ne pas polluer les autres tests
    await prismaTest.schoolConfig.update({ where: { schoolId }, data: { messageModeration: false } });
  });
});
