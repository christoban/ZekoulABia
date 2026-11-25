/**
 * Test d'intégration — EleveOnboardingController.renvoyerLien, touché par le retrait du cast
 * `(this.prisma as any)` sur les champs `eleveDispositifOS`/`parentDispositifOS`
 * (StudentOnboarding.*DispositifOS sont des colonnes String libres en base, mais typées
 * `DispositifOS` — union 'ANDROID'|'IOS'|'AUTRE' — côté application). Vérifie sur la vraie
 * base que le renvoi de lien (qui expire l'ancien dossier et en recrée un nouveau via
 * CreerSqueletteOnboardingUseCase) fonctionne toujours une fois le cast remplacé par un
 * typage précis, et propage bien ces deux champs vers le nouveau dossier.
 *
 * Contacts volontairement laissés à null sur le dossier de test : la notification
 * fire-and-forget (notifierOnboardingLienCree) devient alors un no-op — aucun email/SMS réel
 * envoyé — sans avoir besoin de mocker les services de notification pour ce test.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
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
let dossierId: string;

const authHeaders = () => ({ Cookie: `access_token=${adminToken}` });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'onboardingResend');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  await prismaTest.schoolOnboardingSettings.create({ data: { schoolId, selfServiceEnabled: true } });

  const dossier = await prismaTest.studentOnboarding.create({
    data: {
      schoolId,
      nomProvisoire: 'Dossier Test Resend',
      status: 'LINK_SENT',
      token: randomUUID(),
      tokenExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      eleveADispositif: true,
      eleveDispositifOS: 'ANDROID',
      parentADispositif: false,
      parentDispositifOS: null,
    },
  });
  dossierId = dossier.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.studentOnboarding.deleteMany({ where: { schoolId } });
  await prismaTest.schoolOnboardingSettings.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe("EleveOnboardingController.renvoyerLien — propagation DispositifOS sans cast", () => {
  it("expire l'ancien dossier et en recrée un nouveau conservant eleveDispositifOS/parentDispositifOS", async () => {
    const res = await fetch(`${baseUrl}/eleve-onboarding/${dossierId}/resend-link`, {
      method: 'POST',
      headers: authHeaders(),
    });
    const body = await res.json() as { success: boolean; message?: string; data?: { id: string; token: string } };

    if (!body.success) throw new Error(`Échec renvoi de lien : ${body.message ?? JSON.stringify(body)}`);
    expect(res.status).toBe(200);

    const ancien = await prismaTest.studentOnboarding.findUnique({ where: { id: dossierId } });
    expect(ancien?.status).toBe('EXPIRED');

    const nouveauId = body.data!.id;
    expect(nouveauId).not.toBe(dossierId);
    const nouveau = await prismaTest.studentOnboarding.findUnique({ where: { id: nouveauId } });
    expect(nouveau).not.toBeNull();
    expect(nouveau?.status).toBe('LINK_SENT');
    expect(nouveau?.eleveADispositif).toBe(true);
    expect(nouveau?.eleveDispositifOS).toBe('ANDROID');
    expect(nouveau?.parentADispositif).toBe(false);
    expect(nouveau?.parentDispositifOS).toBeNull();
  });
});
