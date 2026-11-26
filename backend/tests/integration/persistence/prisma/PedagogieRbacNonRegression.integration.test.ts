/**
 * Tests d'intégration de non-régression RBAC Pédagogie sur PostgreSQL local (zekoulabia_test uniquement).
 * Vérifie de bout en bout (routes Express réelles + requireAuth + Controllers + UseCases + Prisma) :
 * (1) Enseignant simple affecté : lecture chapitres (has-programme) + création/lecture cahier de texte lié à un chapitre ;
 * (2) Enseignant simple affecté : lecture progression de sa propre classe ;
 * (3) Élève & Parent : 403 sur toutes les routes d'écriture (programmes, chapitres, cahier, coches, modules) & lectures privées,
 *     tout en gardant la lecture seule du cahier de texte de classe ;
 * (4) Enseignant NON affecté : 403 sur has-programme, progression, coche directe, bascule module et saisie cahier,
 *     while gardant l'accès à sa propre classe/matière ;
 * (5) AP de département isolé à son département ; Admin et Censeur (MANAGE_CLASSES) accès établissement.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import express from 'express';
import cookieParser from 'cookie-parser';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import { prismaTest } from '../../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../../helpers/dbFixtures.ts';
import { requireAuth } from '@infrastructure/http/middlewares/auth';
import { creerPedagogieRoutes } from '@infrastructure/http/routes/pedagogie.routes';
import { PedagogieController } from '@infrastructure/http/controllers/PedagogieController';
import { PedagogieMaterialisationController } from '@infrastructure/http/controllers/PedagogieMaterialisationController';
import { PedagogiePilotageController } from '@infrastructure/http/controllers/PedagogiePilotageController';
import { PrismaProgrammeRepository } from '@infrastructure/persistence/prisma/PrismaProgrammeRepository';
import { PrismaChapitreRepository } from '@infrastructure/persistence/prisma/PrismaChapitreRepository';
import { PrismaCahierDeTexteRepository } from '@infrastructure/persistence/prisma/PrismaCahierDeTexteRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaAnneeAcademiqueRepository } from '@infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository';
import { PrismaDepartmentRepository } from '@infrastructure/persistence/prisma/PrismaDepartmentRepository';
import { PrismaRattachementEnseignantRepository } from '@infrastructure/persistence/prisma/PrismaRattachementEnseignantRepository';
import { PrismaChapitreAvancementRepository } from '@infrastructure/persistence/prisma/PrismaChapitreAvancementRepository';
import { PrismaMaterialisationProgrammeRepository } from '@infrastructure/persistence/prisma/PrismaMaterialisationProgrammeRepository';
import { PrismaTimetableRepository } from '@infrastructure/persistence/prisma/PrismaTimetableRepository';
import { ListerProgrammeUseCase } from '@application/pedagogie/ListerProgrammeUseCase';
import { GererProgrammeUseCase } from '@application/pedagogie/GererProgrammeUseCase';
import { GererChapitreUseCase } from '@application/pedagogie/GererChapitreUseCase';
import { GererCahierDeTexteUseCase } from '@application/pedagogie/GererCahierDeTexteUseCase';
import { CalculerProgressionProgrammeUseCase } from '@application/pedagogie/CalculerProgressionProgrammeUseCase';
import { ObtenirSlotDuJourUseCase } from '@application/pedagogie/ObtenirSlotDuJourUseCase';
import { GenererRapportPedagogieUseCase } from '@application/pedagogie/GenererRapportPedagogieUseCase';
import { ProposerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/ProposerInitialisationProgrammesClasseUseCase';
import { AppliquerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/AppliquerInitialisationProgrammesClasseUseCase';
import { BasculerAvancementChapitreUseCase } from '@application/pedagogie/BasculerAvancementChapitreUseCase';
import { BasculerModuleActifUseCase } from '@application/pedagogie/BasculerModuleActifUseCase';
import { GenererRapportAvancementProgrammesUseCase } from '@application/pedagogie/GenererRapportAvancementProgrammesUseCase';
import { RelancerRetardsProgrammesUseCase } from '@application/pedagogie/RelancerRetardsProgrammesUseCase';
import { PedagogieForbiddenError } from '@application/pedagogie/errors';
import {
  OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG,
  OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV,
} from '@infrastructure/config/featureFlags';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { NotificationService } from '@domain/ports/services/NotificationService';

// Garde stricte : uniquement localhost/zekoulabia_test
const dbUrl = process.env.DATABASE_URL ?? '';
if (!/^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1):5432\/zekoulabia_test(\?|$)/.test(dbUrl)) {
  throw new Error(`Refus d'exécuter hors localhost/zekoulabia_test (${dbUrl})`);
}

const noopAudit: AIActionAuditPort = { journaliser: () => {} };
const noopNotif: NotificationService = {
  envoyer: async () => {},
  envoyerAuRole: async () => {},
  marquerLue: async () => {},
  marquerDelivree: async () => false,
  marquerConfirmee: async () => false,
};

const JWT_SECRET = process.env.JWT_SECRET || 'rbac_integration_test_secret';
const prevJwt = process.env.JWT_SECRET;
const prevFlag = process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG];
const prevPilots = process.env[OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV];

function makeToken(user: { userId: string; schoolId: string; role: string; permissions?: string[] }): string {
  return jwt.sign(
    {
      userId: user.userId,
      schoolId: user.schoolId,
      role: user.role,
      permissions: user.permissions ?? [],
      tokenType: 'access',
    },
    JWT_SECRET,
    { expiresIn: '15m' },
  );
}

let server: Server;
let baseUrl: string;
let schoolId: string;
let academicYearId: string;
let class6eId: string;
let class5eId: string;
let subMathsId: string;
let subFrId: string;
let mathsProgId: string;
let mathsCh1Id: string;
let frProgId: string;
let gererCahierUseCase: GererCahierDeTexteUseCase;

let tokenAdmin: string;
let tokenCenseur: string;
let tokenApMaths: string;
let tokenTeacherAssigned: string;
let tokenTeacherUnassigned: string;
let tokenStudent: string;
let tokenParent: string;
let studentId: string;
let parentId: string;

async function reqJson(
  path: string,
  token: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(`${baseUrl}${path}`, {
    method: opts.method ?? 'GET',
    headers: {
      Cookie: `access_token=${token}`,
      ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

beforeAll(async () => {
  process.env.JWT_SECRET = JWT_SECRET;

  const tag = `rbac_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const school = await creerEcoleTest(prismaTest, tag);
  schoolId = school.id;

  process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG] = 'true';
  process.env[OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV] = schoolId;

  const [admin, censeur, apMaths, tAssigned, tUnassigned, student, parent] = await Promise.all([
    creerUtilisateurTest(prismaTest, schoolId, { role: 'ADMIN', suffix: `adm-${tag}` }),
    creerUtilisateurTest(prismaTest, schoolId, { role: 'STAFF', suffix: `cen-${tag}` }),
    creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: `apm-${tag}` }),
    creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: `ta-${tag}` }),
    creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: `tu-${tag}` }),
    creerUtilisateurTest(prismaTest, schoolId, { role: 'STUDENT', suffix: `stu-${tag}` }),
    creerUtilisateurTest(prismaTest, schoolId, { role: 'PARENT', suffix: `par-${tag}` }),
  ]);
  studentId = student.id;
  parentId = parent.id;

  const year = await prismaTest.academicYear.create({
    data: {
      schoolId,
      name: `2025-2026-${tag}`,
      startDate: new Date(Date.now() - 60 * 86400000),
      endDate: new Date(Date.now() + 60 * 86400000),
      isCurrent: true,
      status: 'ACTIVE',
    },
  });
  academicYearId = year.id;

  const [c6e, c5e] = await Promise.all([
    prismaTest.class.create({ data: { schoolId, academicYearId, name: `6e A ${tag}`, level: '6e', status: 'ACTIVE' } }),
    prismaTest.class.create({ data: { schoolId, academicYearId, name: `5e B ${tag}`, level: '5e', status: 'ACTIVE' } }),
  ]);
  class6eId = c6e.id;
  class5eId = c5e.id;

  const [deptMaths, deptFr] = await Promise.all([
    prismaTest.department.create({ data: { schoolId, name: 'Département Maths', color: '#2563eb', headId: apMaths.id } }),
    prismaTest.department.create({ data: { schoolId, name: 'Département Français', color: '#dc2626' } }),
  ]);

  const [sMaths, sFr] = await Promise.all([
    prismaTest.subject.create({ data: { schoolId, name: 'Mathématiques', departmentId: deptMaths.id } }),
    prismaTest.subject.create({ data: { schoolId, name: 'Français', departmentId: deptFr.id } }),
  ]);
  subMathsId = sMaths.id;
  subFrId = sFr.id;

  // Affectations strictes : tAssigned → (6e A, Maths) ; tUnassigned → (5e B, Français)
  await prismaTest.teachingAssignment.createMany({
    data: [
      { schoolId, academicYearId, classId: class6eId, subjectId: subMathsId, teacherId: tAssigned.id },
      { schoolId, academicYearId, classId: class5eId, subjectId: subFrId, teacherId: tUnassigned.id },
    ],
  });

  const progMaths = await prismaTest.programme.create({
    data: { schoolId, academicYearId, classId: class6eId, subjectId: subMathsId, level: '6e', titre: 'Maths 6e', source: 'national' },
  });
  mathsProgId = progMaths.id;
  const ch1 = await prismaTest.chapitre.create({
    data: { programmeId: mathsProgId, titre: 'Nombres entiers', ordre: 1, moduleOrdre: 1, moduleTitre: 'M1', volumeHeuresPrevu: null },
  });
  mathsCh1Id = ch1.id;
  await prismaTest.chapitre.create({
    data: { programmeId: mathsProgId, titre: 'Droites du plan', ordre: 2, moduleOrdre: 2, moduleTitre: 'M2', volumeHeuresPrevu: null },
  });

  const progFr = await prismaTest.programme.create({
    data: { schoolId, academicYearId, classId: class5eId, subjectId: subFrId, level: '5e', titre: 'Français 5e', source: 'manuel' },
  });
  frProgId = progFr.id;
  await prismaTest.chapitre.create({
    data: { programmeId: frProgId, titre: 'Récit narratif', ordre: 1, volumeHeuresPrevu: 2 },
  });

  // Montage Express réel identique au serveur de production
  const progRepo = new PrismaProgrammeRepository(prismaTest);
  const chapRepo = new PrismaChapitreRepository(prismaTest);
  const cahierRepo = new PrismaCahierDeTexteRepository(prismaTest);
  const classeRepo = new PrismaClasseRepository(prismaTest);
  const anneeRepo = new PrismaAnneeAcademiqueRepository(prismaTest);
  const deptRepo = new PrismaDepartmentRepository(prismaTest);
  const rattachementRepo = new PrismaRattachementEnseignantRepository(prismaTest);
  const avRepo = new PrismaChapitreAvancementRepository(prismaTest);
  const matRepo = new PrismaMaterialisationProgrammeRepository(prismaTest);
  const ttRepo = new PrismaTimetableRepository(prismaTest);

  gererCahierUseCase = new GererCahierDeTexteUseCase(cahierRepo, anneeRepo, rattachementRepo);
  const calcProg = new CalculerProgressionProgrammeUseCase(
    progRepo,
    cahierRepo,
    classeRepo,
    anneeRepo,
    avRepo,
    deptRepo,
    rattachementRepo,
  );
  const pedagogieCtrl = new PedagogieController(
    new ListerProgrammeUseCase(progRepo, deptRepo),
    new GererProgrammeUseCase(progRepo, anneeRepo, deptRepo),
    new GererChapitreUseCase(chapRepo, progRepo, deptRepo),
    gererCahierUseCase,
    calcProg,
    new ObtenirSlotDuJourUseCase(ttRepo, anneeRepo),
    new GenererRapportPedagogieUseCase(cahierRepo, deptRepo, anneeRepo),
    noopAudit,
  );
  const propInit = new ProposerInitialisationProgrammesClasseUseCase(matRepo);
  const matCtrl = new PedagogieMaterialisationController(
    propInit,
    new AppliquerInitialisationProgrammesClasseUseCase(propInit, matRepo),
    new BasculerAvancementChapitreUseCase(avRepo, cahierRepo, rattachementRepo),
    new BasculerModuleActifUseCase(avRepo, rattachementRepo),
    noopAudit,
  );
  const pilotageCtrl = new PedagogiePilotageController(
    new GenererRapportAvancementProgrammesUseCase(progRepo, cahierRepo, classeRepo, anneeRepo, avRepo, deptRepo),
    new RelancerRetardsProgrammesUseCase(calcProg, deptRepo, noopNotif),
    noopAudit,
  );

  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/v2/pedagogie', requireAuth, creerPedagogieRoutes(pedagogieCtrl, matCtrl, undefined, pilotageCtrl));

  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as AddressInfo;
  baseUrl = `http://127.0.0.1:${addr.port}/api/v2/pedagogie`;

  tokenAdmin = makeToken({ userId: admin.id, schoolId, role: 'ADMIN' });
  tokenCenseur = makeToken({ userId: censeur.id, schoolId, role: 'STAFF', permissions: ['MANAGE_CLASSES'] });
  tokenApMaths = makeToken({ userId: apMaths.id, schoolId, role: 'TEACHER' });
  tokenTeacherAssigned = makeToken({ userId: tAssigned.id, schoolId, role: 'TEACHER' });
  tokenTeacherUnassigned = makeToken({ userId: tUnassigned.id, schoolId, role: 'TEACHER' });
  tokenStudent = makeToken({ userId: student.id, schoolId, role: 'STUDENT' });
  tokenParent = makeToken({ userId: parent.id, schoolId, role: 'PARENT' });
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (schoolId) {
    await nettoyerEcole(prismaTest, schoolId);
  }
  if (prevJwt === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = prevJwt;
  if (prevFlag === undefined) delete process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG];
  else process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG] = prevFlag;
  if (prevPilots === undefined) delete process.env[OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV];
  else process.env[OFFICIAL_PROGRAMMES_PILOT_SCHOOL_IDS_ENV] = prevPilots;
  await prismaTest.$disconnect();
});

describe('Non-régression RBAC Pédagogie sur zekoulabia_test (commit fdbb8509 + durcissement lecture/cahier)', () => {
  it('(1) & (2) Enseignant simple affecté : lit chapitres (has-programme), saisit et lit son cahier lié à un chapitre, lit sa progression, mais ne peut PAS modifier le catalogue', async () => {
    // Lecture chapitres pour CahierSaisieTab
    const hasProg = await reqJson(`/subjects/${subMathsId}/has-programme?classId=${class6eId}`, tokenTeacherAssigned);
    expect(hasProg.status).toBe(200);
    const dataHas = hasProg.body.data as { hasProgramme: boolean; chapitres: Array<{ id: string }> };
    expect(dataHas.hasProgramme).toBe(true);
    expect(dataHas.chapitres).toHaveLength(2);

    // Création d'une entrée de cahier de texte liée au chapitre ch1
    const createCahier = await reqJson('/cahier-de-texte', tokenTeacherAssigned, {
      method: 'POST',
      body: {
        classId: class6eId,
        subjectId: subMathsId,
        chapitreId: mathsCh1Id,
        contenuRealise: 'Introduction aux entiers naturels',
        devoirsDonnes: 'Ex 1 à 3 p. 12',
      },
    });
    expect(createCahier.status).toBe(201);

    // Lecture de ses propres entrées cahier
    const listCahier = await reqJson(`/cahier-de-texte?classId=${class6eId}`, tokenTeacherAssigned);
    expect(listCahier.status).toBe(200);
    expect((listCahier.body.data as unknown[]).length).toBe(1);

    // Lecture de la progression de sa propre classe (scénario 2)
    const prog = await reqJson(`/progression?classId=${class6eId}&subjectId=${subMathsId}`, tokenTeacherAssigned);
    expect(prog.status).toBe(200);
    const progData = prog.body.data as { leconsTotal: number; leconsRealisees: number; progressionPct: number };
    expect(progData.leconsTotal).toBe(2);
    expect(progData.leconsRealisees).toBe(1);
    expect(progData.progressionPct).toBe(50);

    // Coche directe autorisée sur sa propre classe/matière
    const coche = await reqJson(`/chapitres/${mathsCh1Id}/avancement`, tokenTeacherAssigned, {
      method: 'PUT',
      body: { classId: class6eId, fait: true },
    });
    expect(coche.status).toBe(200);

    // Droits d'écriture catalogue strictement refusés (403) — aucun élargissement
    expect((await reqJson('/programmes', tokenTeacherAssigned)).status).toBe(403);
    expect(
      (await reqJson('/programmes', tokenTeacherAssigned, {
        method: 'POST',
        body: { titre: 'Hack', subjectId: subMathsId, classId: class6eId },
      })).status,
    ).toBe(403);
    expect(
      (await reqJson(`/programmes/${mathsProgId}/chapitres`, tokenTeacherAssigned, {
        method: 'POST',
        body: { titre: 'Hack chap' },
      })).status,
    ).toBe(403);
    expect(
      (await reqJson(`/chapitres/${mathsCh1Id}`, tokenTeacherAssigned, { method: 'PATCH', body: { titre: 'Hack' } }))
        .status,
    ).toBe(403);
    expect((await reqJson(`/chapitres/${mathsCh1Id}`, tokenTeacherAssigned, { method: 'DELETE' })).status).toBe(403);
    expect((await reqJson('/alertes-retard', tokenTeacherAssigned)).status).toBe(403);
    expect((await reqJson('/rapports/avancement', tokenTeacherAssigned)).status).toBe(403);
  });

  it('(3) Élève et Parent : 403 sur toutes les routes d écriture (y compris POST /cahier-de-texte) et lectures privées, mais lecture seule du cahier conservée', async () => {
    for (const tok of [tokenStudent, tokenParent]) {
      expect(
        (await reqJson('/programmes', tok, {
          method: 'POST',
          body: { titre: 'Interdit', subjectId: subMathsId, classId: class6eId },
        })).status,
      ).toBe(403);
      expect((await reqJson(`/programmes/${mathsProgId}`, tok, { method: 'PATCH', body: { titre: 'X' } })).status).toBe(403);
      expect((await reqJson(`/programmes/${mathsProgId}`, tok, { method: 'DELETE' })).status).toBe(403);
      expect(
        (await reqJson(`/programmes/${mathsProgId}/chapitres`, tok, { method: 'POST', body: { titre: 'X' } })).status,
      ).toBe(403);
      expect((await reqJson(`/chapitres/${mathsCh1Id}`, tok, { method: 'PATCH', body: { titre: 'X' } })).status).toBe(403);
      expect((await reqJson(`/chapitres/${mathsCh1Id}`, tok, { method: 'DELETE' })).status).toBe(403);
      expect(
        (await reqJson('/cahier-de-texte', tok, {
          method: 'POST',
          body: { classId: class6eId, subjectId: subMathsId, contenuRealise: 'Injection élève/parent' },
        })).status,
      ).toBe(403);
      expect(
        (await reqJson(`/chapitres/${mathsCh1Id}/avancement`, tok, { method: 'PUT', body: { classId: class6eId, fait: true } }))
          .status,
      ).toBe(403);
      expect(
        (await reqJson(`/programmes/${mathsProgId}/modules/1/statut`, tok, { method: 'PUT', body: { actif: false } })).status,
      ).toBe(403);
      expect((await reqJson(`/progression?classId=${class6eId}&subjectId=${subMathsId}`, tok)).status).toBe(403);
      expect((await reqJson(`/subjects/${subMathsId}/has-programme?classId=${class6eId}`, tok)).status).toBe(403);
      expect((await reqJson('/programmes', tok)).status).toBe(403);
      expect((await reqJson('/alertes-retard', tok)).status).toBe(403);
      expect((await reqJson('/rapports/avancement', tok)).status).toBe(403);

      // Lecture seule du cahier de texte (devoirs) reste accessible
      const readCahier = await reqJson(`/cahier-de-texte?classId=${class6eId}`, tok);
      expect(readCahier.status).toBe(200);
    }

    // Défense en profondeur au niveau Use Case (hors middleware Express)
    await expect(
      gererCahierUseCase.creer({
        schoolId,
        teacherId: studentId,
        role: 'STUDENT',
        classId: class6eId,
        subjectId: subMathsId,
        contenuRealise: 'Contournement direct',
      }),
    ).rejects.toBeInstanceOf(PedagogieForbiddenError);
    await expect(
      gererCahierUseCase.creer({
        schoolId,
        teacherId: parentId,
        role: 'PARENT',
        classId: class6eId,
        subjectId: subMathsId,
        contenuRealise: 'Contournement parent',
      }),
    ).rejects.toBeInstanceOf(PedagogieForbiddenError);
  });

  it('(4) Enseignant NON affecté : ne voit PAS le programme/progression (403), ne peut PAS cocher/basculer/saisir (403), mais accède à sa propre classe', async () => {
    // Sur (6e A, Mathématiques) où il n'est PAS affecté : tout est bloqué 403
    expect((await reqJson(`/subjects/${subMathsId}/has-programme?classId=${class6eId}`, tokenTeacherUnassigned)).status).toBe(403);
    expect((await reqJson(`/subjects/${subMathsId}/has-programme`, tokenTeacherUnassigned)).status).toBe(403);
    expect((await reqJson(`/progression?classId=${class6eId}&subjectId=${subMathsId}`, tokenTeacherUnassigned)).status).toBe(403);
    expect(
      (await reqJson(`/chapitres/${mathsCh1Id}/avancement`, tokenTeacherUnassigned, {
        method: 'PUT',
        body: { classId: class6eId, fait: true },
      })).status,
    ).toBe(403);
    expect(
      (await reqJson(`/programmes/${mathsProgId}/modules/1/statut`, tokenTeacherUnassigned, {
        method: 'PUT',
        body: { actif: false },
      })).status,
    ).toBe(403);
    expect(
      (await reqJson('/cahier-de-texte', tokenTeacherUnassigned, {
        method: 'POST',
        body: { classId: class6eId, subjectId: subMathsId, contenuRealise: 'Saisie non autorisée' },
      })).status,
    ).toBe(403);

    // Sur sa PROPRE classe affectée (5e B, Français) : lecture chapitres & progression OK (200)
    expect((await reqJson(`/subjects/${subFrId}/has-programme?classId=${class5eId}`, tokenTeacherUnassigned)).status).toBe(200);
    expect((await reqJson(`/progression?classId=${class5eId}&subjectId=${subFrId}`, tokenTeacherUnassigned)).status).toBe(200);
  });

  it('(5) AP Maths scopé à Maths (403 sur Français) ; Admin & Censeur (MANAGE_CLASSES) accès établissement', async () => {
    // AP Maths : OK sur Maths, 403 sur Français
    expect((await reqJson(`/progression?classId=${class6eId}&subjectId=${subMathsId}`, tokenApMaths)).status).toBe(200);
    expect((await reqJson(`/subjects/${subMathsId}/has-programme?classId=${class6eId}`, tokenApMaths)).status).toBe(200);
    expect((await reqJson(`/progression?classId=${class5eId}&subjectId=${subFrId}`, tokenApMaths)).status).toBe(403);
    expect((await reqJson(`/subjects/${subFrId}/has-programme?classId=${class5eId}`, tokenApMaths)).status).toBe(403);

    // Admin et Censeur : OK sur les deux
    for (const tok of [tokenAdmin, tokenCenseur]) {
      expect((await reqJson(`/progression?classId=${class6eId}&subjectId=${subMathsId}`, tok)).status).toBe(200);
      expect((await reqJson(`/progression?classId=${class5eId}&subjectId=${subFrId}`, tok)).status).toBe(200);
    }
  });
});

