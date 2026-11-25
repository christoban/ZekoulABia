/**
 * Test d'intégration — rebranchement des chemins de génération sur l'entité CreneauHoraire.
 *
 * Le cas central (premier test) est une NON-RÉGRESSION du bug de fond : avant ce chantier,
 * `generate-skeleton` écrivait les jours en 1-6 en contournant l'entité, tandis que
 * `AjouterCreneauUseCase` les lit en 0-5. Un lundi stocké en 1 et un lundi vérifié en 0 ne se
 * voyaient donc jamais : la détection de conflit enseignant était aveugle entre les deux
 * conventions, et un enseignant pouvait être double-booké sans qu'aucune vérification ne le
 * détecte. Ce test échouerait avec l'ancien code.
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
let academicYearId: string;
let classeAId: string;
let classeBId: string;
let teacherId: string;
let subjectId: string;

const headers = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'conventionJours');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: 'jours-admin' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  academicYearId = annee.id;

  classeAId = (await prismaTest.class.create({
    data: { schoolId, academicYearId, name: '6e A', level: '6e', capacity: 40, status: 'ACTIVE' },
  })).id;
  classeBId = (await prismaTest.class.create({
    data: { schoolId, academicYearId, name: '6e B', level: '6e', capacity: 40, status: 'ACTIVE' },
  })).id;

  teacherId = (await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: 'jours-prof' })).id;
  subjectId = (await prismaTest.subject.create({
    data: { schoolId, name: 'Mathématiques', subjectType: 'THEORETICAL' },
  })).id;

  // Grille : lundi + mardi, 2 périodes de 1h à partir de 08:00.
  await prismaTest.timetableGridConfig.create({
    data: {
      schoolId, heureDebut: '08:00', dureePeriode: 60,
      periodesAvantP1: 2, dureePetitePause: 0,
      periodesAvantP2: 0, dureeGrandePause: 0, periodesApresP2: 0,
      joursActifs: ['LUNDI', 'MARDI'],
    },
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.timetableSlot.deleteMany({ where: { timetable: { schoolId } } });
  await prismaTest.timetable.deleteMany({ where: { schoolId } });
  await prismaTest.timetableGridConfig.deleteMany({ where: { schoolId } });
  await prismaTest.subject.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('Convention des jours — les chemins de génération passent par l\'entité', () => {
  it('generate-skeleton écrit les jours en 0-5 (0=Lundi), validés par CreneauHoraire', async () => {
    const res = await fetch(`${baseUrl}/timetables/generate-skeleton`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ classId: classeAId }),
    });
    const body = await res.json() as { success: boolean; message?: string; data?: { id: string; slots: { dayOfWeek: number }[] } };
    if (!body.success) throw new Error(`Échec squelette : ${JSON.stringify(body)}`);
    expect(res.status).toBe(201);

    // 2 jours × 2 périodes = 4 créneaux, et AUCUN jour hors 0-5.
    expect(body.data!.slots).toHaveLength(4);
    const jours = [...new Set(body.data!.slots.map(s => s.dayOfWeek))].sort();
    expect(jours).toEqual([0, 1]); // Lundi, Mardi — plus jamais 1 et 2

    // Le lundi (0) n'a PAS été avalé par un `.filter(Boolean)`.
    expect(body.data!.slots.filter(s => s.dayOfWeek === 0)).toHaveLength(2);
  });

  it("NON-RÉGRESSION — un créneau issu du squelette entre bien en conflit avec un créneau saisi à la main", async () => {
    // La classe A a un squelette (créé au test précédent) : on y pose un cours réel avec un
    // enseignant, le lundi 08:00. Puis on tente le MÊME enseignant, le MÊME lundi 08:00, dans
    // la classe B. Avant le chantier, les deux conventions ne se voyaient pas → aucun conflit
    // détecté, double réservation silencieuse.
    const edtA = await prismaTest.timetable.findFirstOrThrow({ where: { schoolId, classId: classeAId } });
    const slotLundi = await prismaTest.timetableSlot.findFirstOrThrow({
      where: { timetableId: edtA.id, dayOfWeek: 0, startTime: '08:00' },
    });
    await fetch(`${baseUrl}/timetables/${edtA.id}/slots/${slotLundi.id}`, {
      method: 'PUT', headers: headers(),
      body: JSON.stringify({ subjectId, teacherId, kind: 'CLASS' }),
    });

    const resEdtB = await fetch(`${baseUrl}/timetables/manual`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ classId: classeBId, academicYearId }),
    });
    const bodyEdtB = await resEdtB.json() as { data: { timetableId: string } };

    const resConflit = await fetch(`${baseUrl}/timetables/${bodyEdtB.data.timetableId}/slots`, {
      method: 'POST', headers: headers(),
      body: JSON.stringify({
        subjectId, teacherId, kind: 'CLASS',
        dayOfWeek: 0, startTime: '08:00', endTime: '09:00',
      }),
    });
    const bodyConflit = await resConflit.json() as { success: boolean; code?: string; message?: string };

    expect(resConflit.status).toBe(409);
    expect(bodyConflit.code).toBe('CONFLIT_HORAIRE');
    expect(bodyConflit.message).toContain('déjà occupé');
  });

  it('generate-skeleton refuse un second appel sur la même classe (409 + timetableId conservé)', async () => {
    const res = await fetch(`${baseUrl}/timetables/generate-skeleton`, {
      method: 'POST', headers: headers(), body: JSON.stringify({ classId: classeAId }),
    });
    const body = await res.json() as { success: boolean; data?: { timetableId?: string } };

    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
    // Contrat dont dépend le front (bascule sur l'EDT existant).
    expect(body.data?.timetableId).toBeDefined();
  });
});
