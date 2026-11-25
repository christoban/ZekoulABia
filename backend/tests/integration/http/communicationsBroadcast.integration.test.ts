/**
 * Test d'intégration — CommunicationsController.broadcast, révèle et vérifie le correctif
 * d'un bug réel indépendant trouvé en retirant les casts `(prisma as any)` : le calcul du
 * solde restant (`{solde}`) et le filtre `paymentStatus` lisaient `Invoice.paidAmount`, un
 * champ qui n'existe PAS sur le modèle Invoice (seul `Payment.amount` avec status SUCCESS
 * existe). Le cast masquait l'erreur TypeScript, mais Prisma valide `select` à l'exécution —
 * ce chemin de code levait donc déjà une PrismaClientValidationError à chaque diffusion
 * ciblant une classe/un niveau/un statut de paiement, avant même ce chantier de nettoyage.
 *
 * Ce test vérifie sur la vraie base que :
 *  1. Le solde interpolé dans le SMS reflète bien (montant facture − paiements SUCCESS).
 *  2. Le filtre paymentStatus ne retient que les élèves dont la DERNIÈRE facture a ce statut.
 *  3. broadcastLog.target (colonne JSON) persiste bien après le retrait du cast.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { creerEleveAvecClasse } from '@application/shared/studentEnrollment';
import express from 'express';
import cookieParser from 'cookie-parser';
import jwt from 'jsonwebtoken';
import type { Server } from 'http';
import type { AddressInfo } from 'net';
import { PrismaEnrollmentRepository } from '@infrastructure/persistence/prisma/PrismaEnrollmentRepository';
import { prismaTest } from '../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../helpers/dbFixtures.ts';

const enrollmentRepo = new PrismaEnrollmentRepository(prismaTest);

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET non défini — requis dans .env.test pour ce test.');
}

const originalTechsoftApiKey = process.env.TECHSOFT_API_KEY;
process.env.TECHSOFT_API_KEY = '';

const { bootstrapHexagonal } = await import('@infrastructure/config/hexagonal.bootstrap');

let server: Server;
let baseUrl: string;
let schoolId: string;
let adminToken: string;
let classId: string;
let studentPartielUserId: string;
let studentAttenteUserId: string;

const authHeaders = () => ({ Cookie: `access_token=${adminToken}`, 'Content-Type': 'application/json' });

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const school = await creerEcoleTest(prismaTest, 'broadcastSolde');
  schoolId = school.id;

  const admin = await creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN' });
  adminToken = jwt.sign(
    { userId: admin.id, schoolId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-06-30'), isCurrent: true },
  });
  const classe = await prismaTest.class.create({ data: { schoolId, academicYearId: annee.id, name: '5ème Broadcast', level: '5ème' } });
  classId = classe.id;

  // Élève A : facture PARTIAL de 50000, déjà 20000 payés (SUCCESS) → solde attendu 30000.
  const studentPartiel = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'bcast-partiel' });
  studentPartielUserId = studentPartiel.id;
  const profilePartiel = await creerEleveAvecClasse(enrollmentRepo, { userId: studentPartiel.id, classId, enrolledById: studentPartiel.id });
  const parentPartielUser = await creerUtilisateurTest(prismaTest, schoolId, { role: 'PARENT', suffix: 'bcast-partiel-parent' });
  await prismaTest.user.update({ where: { id: parentPartielUser.id }, data: { phone: '677000001' } });
  const parentPartielProfile = await prismaTest.parentProfile.create({ data: { userId: parentPartielUser.id } });
  await prismaTest.parentStudent.create({ data: { parentProfileId: parentPartielProfile.id, studentProfileId: profilePartiel.id } });

  const invoicePartiel = await prismaTest.invoice.create({
    data: { schoolId, studentId: studentPartiel.id, amount: 50000, status: 'PARTIAL', description: 'Scolarité' },
  });
  await prismaTest.payment.create({
    data: { schoolId, invoiceId: invoicePartiel.id, studentId: studentPartiel.id, amount: 20000, status: 'SUCCESS' },
  });
  // Paiement FAILED : ne doit PAS compter dans le solde payé.
  await prismaTest.payment.create({
    data: { schoolId, invoiceId: invoicePartiel.id, studentId: studentPartiel.id, amount: 5000, status: 'FAILED' },
  });

  // Élève B : facture PENDING de 30000, aucun paiement → solde attendu 30000, mais statut PENDING (pas PARTIAL).
  const studentAttente = await creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: 'bcast-attente' });
  studentAttenteUserId = studentAttente.id;
  const profileAttente = await creerEleveAvecClasse(enrollmentRepo, { userId: studentAttente.id, classId, enrolledById: studentAttente.id });
  const parentAttenteUser = await creerUtilisateurTest(prismaTest, schoolId, { role: 'PARENT', suffix: 'bcast-attente-parent' });
  await prismaTest.user.update({ where: { id: parentAttenteUser.id }, data: { phone: '677000002' } });
  const parentAttenteProfile = await prismaTest.parentProfile.create({ data: { userId: parentAttenteUser.id } });
  await prismaTest.parentStudent.create({ data: { parentProfileId: parentAttenteProfile.id, studentProfileId: profileAttente.id } });

  await prismaTest.invoice.create({
    data: { schoolId, studentId: studentAttente.id, amount: 30000, status: 'PENDING', description: 'Scolarité' },
  });
});

async function attendre<T>(lecture: () => Promise<T | null>, timeoutMs = 3000): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await lecture();
    if (result) return result;
    await new Promise((r) => setTimeout(r, 25));
  }
  return null;
}

afterAll(async () => {
  process.env.TECHSOFT_API_KEY = originalTechsoftApiKey;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prismaTest.aIActionAuditLog.deleteMany({ where: { schoolId } });
  await prismaTest.broadcastLog.deleteMany({ where: { schoolId } });
  await prismaTest.smsLog.deleteMany({ where: { schoolId } });
  await prismaTest.payment.deleteMany({ where: { schoolId } });
  await prismaTest.invoice.deleteMany({ where: { schoolId } });
  await prismaTest.parentStudent.deleteMany({ where: { parentProfile: { user: { schoolId } } } });
  await prismaTest.parentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.enrollment.deleteMany({ where: { schoolId } });
  await prismaTest.studentProfile.deleteMany({ where: { user: { schoolId } } });
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
  await prismaTest.user.deleteMany({ where: { schoolId } });
  await nettoyerEcole(prismaTest, schoolId);
  await prismaTest.$disconnect();
});

describe('CommunicationsController.broadcast — solde restant calculé via Payment.status=SUCCESS', () => {
  it("cible une classe entière : solde interpolé correct pour chaque parent, paiement FAILED exclu", async () => {
    const res = await fetch(`${baseUrl}/communications/broadcast`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ target: { classId }, channel: 'SMS', message: 'Bonjour, solde restant : {solde}' }),
    });
    const body = await res.json() as { success: boolean; error?: string; data?: { total: number; sent: number; failed: number } };

    if (!body.success) throw new Error(`Échec diffusion : ${body.error ?? JSON.stringify(body)}`);
    expect(res.status).toBe(200);
    expect(body.data!.total).toBe(2);
    expect(body.data!.sent).toBe(2);
    expect(body.data!.failed).toBe(0);

    const soldeAttendu = `${new Intl.NumberFormat('fr-FR').format(30000)} XAF`;
    const smsPartiel = await prismaTest.smsLog.findFirst({ where: { schoolId, to: '237677000001' } });
    expect(smsPartiel?.content).toContain(soldeAttendu);
    expect(smsPartiel?.status).toBe('simulated');

    const smsAttente = await prismaTest.smsLog.findFirst({ where: { schoolId, to: '237677000002' } });
    expect(smsAttente?.content).toContain(soldeAttendu);

    const log = await prismaTest.broadcastLog.findFirst({ where: { schoolId }, orderBy: { createdAt: 'desc' } });
    expect(log).not.toBeNull();
    expect((log!.target as unknown as { classId: string }).classId).toBe(classId);
    expect(log!.recipientCount).toBe(2);

    // journaliserActionIA (AIActionAuditLogger) est fire-and-forget, non attendu par le
    // contrôleur — exerce au passage son propre correctif JSON (parametersSummary), avec un
    // court sondage puisque l'écriture peut ne pas être terminée à la réponse HTTP.
    const auditLog = await attendre(async () =>
      prismaTest.aIActionAuditLog.findFirst({ where: { schoolId, actionName: 'diffuser_message' }, orderBy: { timestamp: 'desc' } }),
    );
    expect(auditLog).not.toBeNull();
    const parametersSummary = auditLog!.parametersSummary as unknown as { channel: string; target: { classId: string } };
    expect(parametersSummary.channel).toBe('SMS');
    expect(parametersSummary.target.classId).toBe(classId);
  });

  it("filtre paymentStatus=PARTIAL : ne retient que l'élève dont la DERNIÈRE facture est PARTIAL", async () => {
    await prismaTest.smsLog.deleteMany({ where: { schoolId } });

    const res = await fetch(`${baseUrl}/communications/broadcasts/preview?paymentStatus=PARTIAL`, {
      method: 'GET',
      headers: authHeaders(),
    });
    const body = await res.json() as { success: boolean; data?: { total: number; withPhone: number } };

    if (!body.success) throw new Error(`Échec preview : ${JSON.stringify(body)}`);
    expect(res.status).toBe(200);
    expect(body.data!.total).toBe(1);
    expect(body.data!.withPhone).toBe(1);
  });
});
