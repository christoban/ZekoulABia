/**
 * Test d'intégration — pipeline de SÉCURITÉ de l'assistant IA (zone à risque n°1 de l'audit).
 *
 * Couvre les deux endpoints où une action IA est réellement EXÉCUTÉE ou ANNULÉE sur des données
 * scolaires — `confirm-action` (actions destructives) et `undo-action`. Ni l'un ni l'autre
 * n'appelle le modèle : ils repartent d'un `AssistantActionLog` déjà en base, ce qui les rend
 * entièrement déterministes et testables de bout en bout, contrairement à `/execute` dont le
 * chemin dépend d'un appel Groq non déterministe (non couvert ici, cf. en-tête du rapport).
 *
 * Les propriétés vérifiées sont celles dont un défaut serait SILENCIEUX en production :
 *  - isolation multi-tenant (une école ne confirme/annule jamais l'action d'une autre) ;
 *  - re-vérification RBAC au moment de la confirmation, sans confiance envers l'appel client ;
 *  - refus de confirmer une action NON destructive via ce canal ;
 *  - garde d'état (une action déjà traitée n'est ni re-exécutée ni annulée deux fois) ;
 *  - fenêtre d'annulation de 5 minutes réellement appliquée ;
 *  - journalisation d'audit des refus.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Prisma } from '@prisma/client';
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
let schoolAId: string;
let schoolBId: string;
let adminAToken: string;
let staffAToken: string;
let adminAId: string;
let academicYearAId: string;

const auth = (token: string) => ({ Cookie: `access_token=${token}`, 'Content-Type': 'application/json' });

/**
 * `journaliserActionIA` est volontairement fire-and-forget dans le contrôleur (l'audit ne doit
 * jamais bloquer la réponse) — on sonde donc au lieu de lire une seule fois.
 */
async function attendreAudit<T>(lecture: () => Promise<T | null>, timeoutMs = 3000): Promise<T | null> {
  const debut = Date.now();
  while (Date.now() - debut < timeoutMs) {
    const resultat = await lecture();
    if (resultat) return resultat;
    await new Promise(r => setTimeout(r, 25));
  }
  return null;
}

/** Crée un log d'action tel que `/execute` l'aurait écrit, sans passer par le modèle. */
async function creerLog(params: {
  schoolId: string; userId: string; actionType: string;
  parameters: Prisma.InputJsonValue;
  destructive?: boolean; status?: string; undoable?: boolean;
  undoData?: Prisma.InputJsonValue; executedAt?: Date;
}) {
  return prismaTest.assistantActionLog.create({
    data: {
      schoolId: params.schoolId,
      userId: params.userId,
      actionType: params.actionType,
      parameters: params.parameters,
      destructive: params.destructive ?? true,
      status: params.status ?? 'PENDING_CONFIRMATION',
      undoable: params.undoable ?? false,
      ...(params.undoData ? { undoData: params.undoData } : {}),
      ...(params.executedAt ? { executedAt: params.executedAt } : {}),
    },
  });
}

async function confirmer(token: string, pendingActionId: string | undefined, confirmed = true) {
  const res = await fetch(`${baseUrl}/assistant/confirm-action`, {
    method: 'POST', headers: auth(token), body: JSON.stringify({ pendingActionId, confirmed }),
  });
  return { res, body: await res.json() as { success: boolean; message?: string; cancelled?: boolean; executed?: { label?: string } } };
}

async function annuler(token: string, actionLogId: string | undefined) {
  const res = await fetch(`${baseUrl}/assistant/undo-action`, {
    method: 'POST', headers: auth(token), body: JSON.stringify({ actionLogId }),
  });
  return { res, body: await res.json() as { success: boolean; message?: string; undone?: boolean } };
}

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  bootstrapHexagonal(app);
  server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${port}/api/v2`;

  const schoolA = await creerEcoleTest(prismaTest, 'assistSecuA');
  schoolAId = schoolA.id;
  const schoolB = await creerEcoleTest(prismaTest, 'assistSecuB');
  schoolBId = schoolB.id;

  const adminA = await creerUtilisateurTest(prismaTest, schoolAId, { role: 'ADMIN', suffix: 'assist-admin-a' });
  adminAId = adminA.id;
  adminAToken = jwt.sign(
    { userId: adminA.id, schoolId: schoolAId, role: 'ADMIN', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  // STAFF sans aucune permission — ne doit pouvoir confirmer aucune action du catalogue Admin.
  const staffA = await creerUtilisateurTest(prismaTest, schoolAId, { role: 'STAFF', suffix: 'assist-staff-a' });
  staffAToken = jwt.sign(
    { userId: staffA.id, schoolId: schoolAId, role: 'STAFF', permissions: [], tokenType: 'access' },
    process.env.JWT_SECRET!,
  );

  const annee = await prismaTest.academicYear.create({
    data: { schoolId: schoolAId, name: '2025-2026', startDate: new Date('2025-09-01'), endDate: new Date('2026-07-31'), isCurrent: true, status: 'ACTIVE' },
  });
  academicYearAId = annee.id;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  for (const schoolId of [schoolAId, schoolBId]) {
    await prismaTest.assistantActionLog.deleteMany({ where: { schoolId } });
    await prismaTest.aIActionAuditLog.deleteMany({ where: { schoolId } });
    await prismaTest.enrollment.deleteMany({ where: { schoolId } });
    await prismaTest.class.deleteMany({ where: { schoolId } });
    await prismaTest.academicYear.deleteMany({ where: { schoolId } });
    await prismaTest.user.deleteMany({ where: { schoolId } });
    await nettoyerEcole(prismaTest, schoolId);
  }
  await prismaTest.$disconnect();
});

describe('confirm-action — isolation multi-tenant et gardes d\'état', () => {
  it("l'action d'une AUTRE école est introuvable (404), sans fuite d'information", async () => {
    const logB = await creerLog({
      schoolId: schoolBId, userId: adminAId, actionType: 'supprimer_classe',
      parameters: { className: 'Classe école B' },
    });

    const { res, body } = await confirmer(adminAToken, logB.id);

    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    // Message générique : ne révèle pas que l'action existe bel et bien ailleurs.
    expect(body.message).toBe('Action introuvable');

    // L'action de l'école B reste intacte.
    const apres = await prismaTest.assistantActionLog.findUniqueOrThrow({ where: { id: logB.id } });
    expect(apres.status).toBe('PENDING_CONFIRMATION');
  });

  it('une action déjà exécutée ne peut pas être re-confirmée (409)', async () => {
    const log = await creerLog({
      schoolId: schoolAId, userId: adminAId, actionType: 'supprimer_classe',
      parameters: { className: 'X' }, status: 'EXECUTED',
    });

    const { res, body } = await confirmer(adminAToken, log.id);
    expect(res.status).toBe(409);
    expect(body.success).toBe(false);
  });

  it('une action déjà annulée ne peut pas être confirmée (409)', async () => {
    const log = await creerLog({
      schoolId: schoolAId, userId: adminAId, actionType: 'supprimer_classe',
      parameters: { className: 'X' }, status: 'CANCELLED',
    });

    const { res } = await confirmer(adminAToken, log.id);
    expect(res.status).toBe(409);
  });

  it('pendingActionId manquant → 400', async () => {
    const { res } = await confirmer(adminAToken, undefined);
    expect(res.status).toBe(400);
  });

  it("confirmed:false annule l'action sans jamais l'exécuter", async () => {
    const classe = await prismaTest.class.create({
      data: { schoolId: schoolAId, academicYearId: academicYearAId, name: 'Classe à garder', capacity: 30, status: 'ACTIVE' },
    });
    const log = await creerLog({
      schoolId: schoolAId, userId: adminAId, actionType: 'supprimer_classe',
      parameters: { className: 'Classe à garder' },
    });

    const { res, body } = await confirmer(adminAToken, log.id, false);

    expect(res.status).toBe(200);
    expect(body.cancelled).toBe(true);
    expect((await prismaTest.assistantActionLog.findUniqueOrThrow({ where: { id: log.id } })).status).toBe('CANCELLED');
    // La classe n'a PAS été supprimée.
    const apres = await prismaTest.class.findUnique({ where: { id: classe.id } });
    expect(apres?.deletedAt ?? null).toBeNull();
  });
});

describe('confirm-action — re-vérification RBAC côté serveur', () => {
  it("un STAFF sans permission ne peut pas confirmer une action du catalogue Admin (403 + audit)", async () => {
    const classe = await prismaTest.class.create({
      data: { schoolId: schoolAId, academicYearId: academicYearAId, name: 'Classe protégée', capacity: 30, status: 'ACTIVE' },
    });
    const log = await creerLog({
      schoolId: schoolAId, userId: adminAId, actionType: 'supprimer_classe',
      parameters: { className: 'Classe protégée' },
    });

    const { res, body } = await confirmer(staffAToken, log.id);

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);

    // La classe n'a pas été touchée…
    const apres = await prismaTest.class.findUnique({ where: { id: classe.id } });
    expect(apres?.deletedAt ?? null).toBeNull();

    // …et le refus est tracé dans l'audit IA avec sa raison.
    const audit = await attendreAudit(() => prismaTest.aIActionAuditLog.findFirst({
      where: { schoolId: schoolAId, actionName: 'supprimer_classe', outcome: 'REFUSE' },
      orderBy: { timestamp: 'desc' },
    }));
    expect(audit).not.toBeNull();
    expect(audit!.refusalReason).toBe('action_hors_catalogue_autorise');
  });

  it("une action NON destructive ne peut pas être exécutée via confirm-action (403)", async () => {
    // Garde-fou important : ce canal est réservé aux actions destructives. Une action
    // non-destructive enregistrée en PENDING_CONFIRMATION (état anormal) ne doit pas s'exécuter.
    const log = await creerLog({
      schoolId: schoolAId, userId: adminAId, actionType: 'creer_classe',
      parameters: { name: 'Classe fantôme' }, destructive: false,
    });

    const { res } = await confirmer(adminAToken, log.id);
    expect(res.status).toBe(403);

    // Aucune classe n'a été créée par ce canal.
    const classe = await prismaTest.class.findFirst({ where: { schoolId: schoolAId, name: 'Classe fantôme' } });
    expect(classe).toBeNull();
  });

  it("une action inconnue du catalogue est refusée (403), même pour un ADMIN", async () => {
    const log = await creerLog({
      schoolId: schoolAId, userId: adminAId, actionType: 'action_qui_nexiste_pas',
      parameters: {},
    });

    const { res } = await confirmer(adminAToken, log.id);
    expect(res.status).toBe(403);
  });
});

describe('confirm-action — exécution réelle du chemin nominal', () => {
  it('un ADMIN confirme : la classe est réellement mise à la corbeille et le log passe à EXECUTED', async () => {
    const classe = await prismaTest.class.create({
      data: { schoolId: schoolAId, academicYearId: academicYearAId, name: 'Classe supprimable', capacity: 30, status: 'ACTIVE' },
    });
    const log = await creerLog({
      schoolId: schoolAId, userId: adminAId, actionType: 'supprimer_classe',
      parameters: { className: 'Classe supprimable' },
    });

    const { res, body } = await confirmer(adminAToken, log.id);
    if (!body.success) throw new Error(`Échec confirmation : ${JSON.stringify(body)}`);
    expect(res.status).toBe(200);

    // Soft-delete effectif (la corbeille, pas une suppression dure).
    const apres = await prismaTest.class.findFirst({
      where: { id: classe.id, deletedAt: { not: null } },
    });
    expect(apres).not.toBeNull();

    const logApres = await prismaTest.assistantActionLog.findUniqueOrThrow({ where: { id: log.id } });
    expect(logApres.status).toBe('EXECUTED');
    expect(logApres.executedAt).not.toBeNull();
  });
});

describe('undo-action — gardes d\'annulation', () => {
  it("l'action d'une AUTRE école est introuvable (404)", async () => {
    const logB = await creerLog({
      schoolId: schoolBId, userId: adminAId, actionType: 'creer_classe',
      parameters: {}, destructive: false, status: 'EXECUTED', undoable: true,
    });

    const { res } = await annuler(adminAToken, logB.id);
    expect(res.status).toBe(404);
  });

  it('une action DESTRUCTIVE ne peut jamais être annulée (409)', async () => {
    const log = await creerLog({
      schoolId: schoolAId, userId: adminAId, actionType: 'supprimer_classe',
      parameters: {}, destructive: true, status: 'EXECUTED', undoable: true,
    });

    const { res } = await annuler(adminAToken, log.id);
    expect(res.status).toBe(409);
  });

  it('une action non marquée undoable ne peut pas être annulée (409)', async () => {
    const log = await creerLog({
      schoolId: schoolAId, userId: adminAId, actionType: 'creer_classe',
      parameters: {}, destructive: false, status: 'EXECUTED', undoable: false,
    });

    const { res } = await annuler(adminAToken, log.id);
    expect(res.status).toBe(409);
  });

  it("une action déjà annulée ne peut pas l'être deux fois (409)", async () => {
    const log = await creerLog({
      schoolId: schoolAId, userId: adminAId, actionType: 'creer_classe',
      parameters: {}, destructive: false, status: 'UNDONE', undoable: true,
    });

    const { res } = await annuler(adminAToken, log.id);
    expect(res.status).toBe(409);
  });

  it('au-delà de la fenêtre de 5 minutes, l\'annulation est refusée (409)', async () => {
    const log = await creerLog({
      schoolId: schoolAId, userId: adminAId, actionType: 'creer_classe',
      parameters: {}, destructive: false, status: 'EXECUTED', undoable: true,
      executedAt: new Date(Date.now() - 6 * 60 * 1000), // 6 minutes
    });

    const { res, body } = await annuler(adminAToken, log.id);
    expect(res.status).toBe(409);
    expect(body.message).toContain('5 minutes');
  });

  it("juste à l'intérieur de la fenêtre, la garde temporelle ne bloque pas", async () => {
    const log = await creerLog({
      schoolId: schoolAId, userId: adminAId, actionType: 'action_qui_nexiste_pas',
      parameters: {}, destructive: false, status: 'EXECUTED', undoable: true,
      executedAt: new Date(Date.now() - 60 * 1000), // 1 minute
    });

    const { res } = await annuler(adminAToken, log.id);
    // 403 (action hors catalogue) et NON 409 : la fenêtre a bien été franchie, c'est la
    // vérification RBAC suivante qui refuse — ce qui prouve que la garde temporelle a laissé passer.
    expect(res.status).toBe(403);
  });

  it('actionLogId manquant → 400', async () => {
    const { res } = await annuler(adminAToken, undefined);
    expect(res.status).toBe(400);
  });
});
