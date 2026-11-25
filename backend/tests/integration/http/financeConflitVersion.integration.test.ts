/**
 * Test d'intégration — V3.2 « Stratégie de conflits » sur les paiements cash.
 * Vérifie sur la vraie base :
 *  - un encaissement cash avec baseUpdatedAt obsolète → 409 CONFLIT_VERSION
 *    (jamais de résolution automatique silencieuse), avec les données d'arbitrage ;
 *  - le double-encaissement au guichet est refusé (transaction atomique) ;
 *  - le flow normal (sans baseUpdatedAt) reste compatible.
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
let studentId: string;
let invoiceId: string;

const authHeaders = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

const encaisser = async (body: Record<string, unknown>) => {
  const res = await fetch(`${baseUrl}/finance/payments/cash`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() as Record<string, unknown> };
};

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'financeConflitVersion');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
  studentId = student.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  // Les notifications/emails fire-and-forget arrivent en différé — attendre qu'ils
  // soient persistés avant de purger, sinon le deleteMany violation RESTRICT.
  await new Promise((r) => setTimeout(r, 500));
  await prismaTest.aIActionAuditLog.deleteMany({ where: { schoolId } });
  await prismaTest.notification.deleteMany({ where: { schoolId } });
  await prismaTest.payment.deleteMany({ where: { schoolId } });
  await prismaTest.invoice.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('FinanceController — V3.2 conflit de version paiements cash', () => {
  it('refuse un encaissement avec baseUpdatedAt obsolète → 409 CONFLIT_VERSION avec les données d\'arbitrage', async () => {
    const invoice = await prismaTest.invoice.create({
      data: { schoolId, studentId, amount: 10000, status: 'PENDING', description: 'Conflit V3.2' },
    });
    invoiceId = invoice.id;

    // Version affichée par le client (stale) : la facture à sa création
    const versionLocale = invoice.updatedAt.toISOString();

    // Un premier encaissement a déjà modifié la facture côté serveur
    const premier = await encaisser({ factureId: invoiceId, studentId, montant: 3000 });
    expect(premier.status).toBe(201);

    // Le client réessaie avec sa vieille version → conflit
    const conflit = await encaisser({
      factureId: invoiceId,
      studentId,
      montant: 3000,
      baseUpdatedAt: versionLocale,
    });

    expect(conflit.status).toBe(409);
    expect((conflit.body as { code?: string }).code).toBe('CONFLIT_VERSION');
    const data = (conflit.body as { data?: Record<string, unknown> }).data;
    expect(data?.factureId).toBe(invoiceId);
    expect(data?.totalPaye).toBe(3000);
    expect(data?.resteARegler).toBe(7000);
  });

  it('ARGENT — le double-encaissement simultané au guichet est refusé', async () => {
    const invoice = await prismaTest.invoice.create({
      data: { schoolId, studentId, amount: 10000, status: 'PENDING', description: 'Double encaissement' },
    });

    // Deux encaissements "simultanés" de 6000 chacun sur une facture de 10000
    const [a, b] = await Promise.all([
      encaisser({ factureId: invoice.id, studentId, montant: 6000 }),
      encaisser({ factureId: invoice.id, studentId, montant: 6000 }),
    ]);

    const succes = [a, b].filter(r => r.status === 201);
    const refus = [a, b].filter(r => r.status !== 201);
    expect(succes).toHaveLength(1);
    expect(refus).toHaveLength(1);

    const paiements = await prismaTest.payment.count({ where: { invoiceId: invoice.id, status: 'SUCCESS' } });
    expect(paiements).toBe(1);
  });
});