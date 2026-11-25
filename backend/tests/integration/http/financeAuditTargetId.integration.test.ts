/**
 * Test d'intégration — FinanceController.creerPlan / creerPaiementCash, touché par le retrait
 * de casts `as any` sur le résultat des use cases. Révèle deux bugs indépendants dans le
 * journal d'audit IA : `(resultat as any)?.id` (CreerPlanFraisResultat n'expose que `planId`,
 * jamais `id` — toujours undefined) et `(resultat as any)?.paiementId` (pure friction, le champ
 * existait déjà). Dans les deux cas, l'action métier elle-même fonctionnait — seul le
 * targetId enregistré dans AIActionAuditLog était cassé pour "creer_plan_frais". Vérifie sur
 * la vraie base que le journal d'audit référence maintenant le bon enregistrement.
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

const attendre = async (predicate: () => Promise<boolean>, timeoutMs = 3000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error('Timeout en attendant le log d\'audit');
};

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'financeAudit');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const student = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT' });
  studentId = student.id;
  const invoice = await prismaTest.invoice.create({
    data: { schoolId, studentId, amount: 10000, status: 'PENDING', description: 'Frais divers' },
  });
  invoiceId = invoice.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  const usersTest = await prismaTest.user.findMany({ where: { schoolId }, select: { id: true } });
  const userIdsTest = usersTest.map((u) => u.id);
  await prismaTest.notification.deleteMany({ where: { userId: { in: userIdsTest } } });
  await prismaTest.notification.deleteMany({ where: { schoolId } });
  await prismaTest.payment.deleteMany({ where: { schoolId } });
  await prismaTest.invoice.deleteMany({ where: { schoolId } });
  await prismaTest.feePlan.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('FinanceController — targetId du journal d\'audit corrigé sans cast any', () => {
  it("creerPlan (POST /finance/fee-plans) journalise le vrai planId, plus jamais undefined", async () => {
    const res = await fetch(`${baseUrl}/finance/fee-plans`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name: 'Frais d\'examen', amount: 5000, feeType: 'EXAM' }),
    });
    const body = await res.json() as { success: boolean; data?: { planId: string } };
    if (!body.success) throw new Error(`Échec création plan : ${JSON.stringify(body)}`);
    expect(res.status).toBe(201);

    await attendre(async () => (await prismaTest.aIActionAuditLog.count({ where: { schoolId, actionName: 'creer_plan_frais' } })) > 0);
    const log = await prismaTest.aIActionAuditLog.findFirst({
      where: { schoolId, actionName: 'creer_plan_frais' }, orderBy: { timestamp: 'desc' },
    });
    expect(log?.targetId).toBe(body.data!.planId);
  });

  it("creerPaiementCash (POST /finance/payments/cash) journalise le vrai paiementId", async () => {
    const res = await fetch(`${baseUrl}/finance/payments/cash`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ factureId: invoiceId, studentId, montant: 4000 }),
    });
    const body = await res.json() as { success: boolean; data?: { paiementId: string } };
    if (!body.success) throw new Error(`Échec paiement cash : ${JSON.stringify(body)}`);
    expect(res.status).toBe(201);

    await attendre(async () => (await prismaTest.aIActionAuditLog.count({ where: { schoolId, actionName: 'enregistrer_paiement_cash' } })) > 0);
    const log = await prismaTest.aIActionAuditLog.findFirst({
      where: { schoolId, actionName: 'enregistrer_paiement_cash' }, orderBy: { timestamp: 'desc' },
    });
    expect(log?.targetId).toBe(body.data!.paiementId);
  });
});
