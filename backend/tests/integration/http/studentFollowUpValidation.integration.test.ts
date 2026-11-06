/**
 * Test d'intégration — StudentFollowUpController.creer, touché par le retrait des casts
 * `type as any` / `interviewMode as any`. Le switch interne de CreerActionSuiviEleveUseCase
 * n'a pas de `default` — un type hors énumération n'y déclenche aucune vérification
 * d'autorisation puis échoue en erreur Prisma peu claire (500) à la persistance. Une
 * validation a été ajoutée en amont, dans le contrôleur, pour retourner un 400 propre avant
 * même d'atteindre le use case.
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
let staffToken: string;
let studentUserId: string;

const authHeaders = () => ({ Cookie: `access_token=${staffToken}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'followUpValidation');
  schoolId = school.id;

  const staff = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STAFF' });
  staffToken = jwt.sign(
    { userId: staff.id, schoolId, role: 'STAFF', permissions: ['CONSEILLER_PEDAGOGIQUE'], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
  studentUserId = student.id;
  await prismaTest.studentProfile.create({ data: { userId: student.id, schoolId } });
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.studentFollowUpAction.deleteMany({ where: { schoolId } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe("StudentFollowUpController.creer — validation type/interviewMode sans cast any", () => {
  it('rejette un type hors énumération avec un 400 propre', async () => {
    const res = await fetch(`${baseUrl}/student-follow-up`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ studentId: studentUserId, type: 'TYPE_INEXISTANT' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { message?: string };
    expect(body.message).toContain('type doit être');

    const actions = await prismaTest.studentFollowUpAction.findMany({ where: { schoolId } });
    expect(actions).toHaveLength(0);
  });

  it('rejette un interviewMode hors énumération avec un 400 propre', async () => {
    const res = await fetch(`${baseUrl}/student-follow-up`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ studentId: studentUserId, type: 'ENTRETIEN_PARENT', interviewMode: 'MODE_INEXISTANT' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json() as { message?: string };
    expect(body.message).toContain('interviewMode doit être');
  });
});
