/**
 * Tests d'intégration réels sur PostgreSQL local (zekoulabia_test uniquement) — Lots 1, 2 & 3.
 * Lancer avec : bun test --env-file .env.test tests/integration/persistence/prisma/MaterialisationProgrammes.integration.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { prismaTest } from '../../../helpers/prismaTestClient.ts';
import { creerEcoleTest, creerUtilisateurTest, nettoyerEcole } from '../../../helpers/dbFixtures.ts';
import { PrismaMaterialisationProgrammeRepository } from '@infrastructure/persistence/prisma/PrismaMaterialisationProgrammeRepository';
import { PrismaChapitreAvancementRepository } from '@infrastructure/persistence/prisma/PrismaChapitreAvancementRepository';
import { PrismaSynchronisationProgrammeRepository } from '@infrastructure/persistence/prisma/PrismaSynchronisationProgrammeRepository';
import { PrismaProgrammeRepository } from '@infrastructure/persistence/prisma/PrismaProgrammeRepository';
import { PrismaChapitreRepository } from '@infrastructure/persistence/prisma/PrismaChapitreRepository';
import { PrismaCahierDeTexteRepository } from '@infrastructure/persistence/prisma/PrismaCahierDeTexteRepository';
import { PrismaClasseRepository } from '@infrastructure/persistence/prisma/PrismaClasseRepository';
import { PrismaAnneeAcademiqueRepository } from '@infrastructure/persistence/prisma/PrismaAnneeAcademiqueRepository';
import { PrismaDepartmentRepository } from '@infrastructure/persistence/prisma/PrismaDepartmentRepository';
import { PrismaRattachementEnseignantRepository } from '@infrastructure/persistence/prisma/PrismaRattachementEnseignantRepository';
import { ProposerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/ProposerInitialisationProgrammesClasseUseCase';
import { AppliquerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/AppliquerInitialisationProgrammesClasseUseCase';
import { BasculerAvancementChapitreUseCase } from '@application/pedagogie/BasculerAvancementChapitreUseCase';
import { BasculerModuleActifUseCase } from '@application/pedagogie/BasculerModuleActifUseCase';
import { CalculerProgressionProgrammeUseCase } from '@application/pedagogie/CalculerProgressionProgrammeUseCase';
import { ListerDerivesProgrammesEcoleUseCase } from '@application/pedagogie/ListerDerivesProgrammesEcoleUseCase';
import { ProposerSynchronisationProgrammeUseCase } from '@application/pedagogie/ProposerSynchronisationProgrammeUseCase';
import { AppliquerSynchronisationProgrammeUseCase } from '@application/pedagogie/AppliquerSynchronisationProgrammeUseCase';
import {
  formaterRapportAvancementCsv,
  GenererRapportAvancementProgrammesUseCase,
} from '@application/pedagogie/GenererRapportAvancementProgrammesUseCase';

// Garde de sécurité stricte : uniquement localhost + zekoulabia_test
const dbUrl = process.env.DATABASE_URL ?? '';
if (!/^postgresql:\/\/[^@]+@(localhost|127\.0\.0\.1):5432\/zekoulabia_test(\?|$)/.test(dbUrl)) {
  throw new Error(`Refus de lancer les tests d'intégration hors localhost/zekoulabia_test (${dbUrl})`);
}

const matRepo = new PrismaMaterialisationProgrammeRepository(prismaTest);
const avRepo = new PrismaChapitreAvancementRepository(prismaTest);
const syncRepo = new PrismaSynchronisationProgrammeRepository(prismaTest);
const progRepo = new PrismaProgrammeRepository(prismaTest);
const chapRepo = new PrismaChapitreRepository(prismaTest);
const cahierRepo = new PrismaCahierDeTexteRepository(prismaTest);
const classeRepo = new PrismaClasseRepository(prismaTest);
const anneeRepo = new PrismaAnneeAcademiqueRepository(prismaTest);
const deptRepo = new PrismaDepartmentRepository(prismaTest);
const rattachementRepo = new PrismaRattachementEnseignantRepository(prismaTest);

const proposerInit = new ProposerInitialisationProgrammesClasseUseCase(matRepo);
const appliquerInit = new AppliquerInitialisationProgrammesClasseUseCase(proposerInit, matRepo);
const basculerAvancement = new BasculerAvancementChapitreUseCase(avRepo, cahierRepo, rattachementRepo);
const basculerModule = new BasculerModuleActifUseCase(avRepo, rattachementRepo);
const calculerProgression = new CalculerProgressionProgrammeUseCase(
  progRepo,
  cahierRepo,
  classeRepo,
  anneeRepo,
  avRepo,
  deptRepo,
);
const listerDerives = new ListerDerivesProgrammesEcoleUseCase(syncRepo);
const proposerSync = new ProposerSynchronisationProgrammeUseCase(syncRepo);
const appliquerSync = new AppliquerSynchronisationProgrammeUseCase(syncRepo);
const genererRapport = new GenererRapportAvancementProgrammesUseCase(
  progRepo,
  cahierRepo,
  classeRepo,
  anneeRepo,
  avRepo,
  deptRepo,
);

const runTag = `int_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const templateCode = `TPL_${runTag}`;

let schoolId: string;
let academicYearId: string;
let teacherId: string;
let apMathsId: string;
let class6eId: string;
let class4eId: string;
let subMathsId: string;
let subFrancaisId: string;
let subClassiquesId: string;
let subAllemandId: string;
let subIntensiveEnId: string;
let subTmId: string;
let deptMathsId: string;
let manualFrProgId: string;
let offMaths6eId: string;
const createdOfficialIds: string[] = [];

beforeAll(async () => {
  await prismaTest.schoolTemplate.create({
    data: {
      code: templateCode,
      name: `Template test ${runTag}`,
      subsystem: 'FRANCOPHONE',
      educationType: 'GENERAL',
      level: 'SECONDARY',
      config: {},
    },
  });

  const school = await creerEcoleTest(prismaTest, `mat-${runTag}`);
  schoolId = school.id;
  await prismaTest.school.update({ where: { id: schoolId }, data: { templateCode } });

  const teacher = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: `t-${runTag}` });
  const apMaths = await creerUtilisateurTest(prismaTest, schoolId, { role: 'TEACHER', suffix: `ap-${runTag}` });
  teacherId = teacher.id;
  apMathsId = apMaths.id;

  const year = await prismaTest.academicYear.create({
    data: {
      schoolId,
      name: `2025-2026-${runTag}`,
      startDate: new Date(Date.now() - 80 * 86400000),
      endDate: new Date(Date.now() + 20 * 86400000),
      isCurrent: true,
      status: 'ACTIVE',
    },
  });
  academicYearId = year.id;

  const [c6e, c4e] = await Promise.all([
    prismaTest.class.create({
      data: {
        schoolId,
        academicYearId,
        name: `6e A ${runTag}`,
        level: '6e',
        filiere: 'FR_GENERAL',
        pebsMixte: true,
        status: 'ACTIVE',
      },
    }),
    prismaTest.class.create({
      data: {
        schoolId,
        academicYearId,
        name: `4e A ${runTag}`,
        level: '4e',
        filiere: 'FR_GENERAL',
        pebsMixte: false,
        status: 'ACTIVE',
      },
    }),
  ]);
  class6eId = c6e.id;
  class4eId = c4e.id;

  const deptMaths = await prismaTest.department.create({
    data: { schoolId, name: 'Département Maths', color: '#2563eb', headId: apMathsId },
  });
  deptMathsId = deptMaths.id;

  const [sMaths, sFr, sClass, sAll, sIntEn, sTm] = await Promise.all([
    prismaTest.subject.create({ data: { schoolId, name: 'Mathématiques', departmentId: deptMathsId } }),
    prismaTest.subject.create({ data: { schoolId, name: 'Français' } }),
    prismaTest.subject.create({ data: { schoolId, name: 'Lettres classiques (Latin/Grec)' } }),
    prismaTest.subject.create({ data: { schoolId, name: 'Allemand' } }),
    prismaTest.subject.create({ data: { schoolId, name: 'Intensive English' } }),
    prismaTest.subject.create({ data: { schoolId, name: 'Travail Manuel' } }),
  ]);
  subMathsId = sMaths.id;
  subFrancaisId = sFr.id;
  subClassiquesId = sClass.id;
  subAllemandId = sAll.id;
  subIntensiveEnId = sIntEn.id;
  subTmId = sTm.id;

  // Affectations enseignant sur 6e (Maths, Français, Lettres classiques, Intensive English, Travail Manuel) et 4e (Lettres classiques, Allemand)
  await prismaTest.teachingAssignment.createMany({
    data: [
      { schoolId, academicYearId, classId: class6eId, subjectId: subMathsId, teacherId },
      { schoolId, academicYearId, classId: class6eId, subjectId: subFrancaisId, teacherId },
      { schoolId, academicYearId, classId: class6eId, subjectId: subClassiquesId, teacherId },
      { schoolId, academicYearId, classId: class6eId, subjectId: subIntensiveEnId, teacherId },
      { schoolId, academicYearId, classId: class6eId, subjectId: subTmId, teacherId },
      { schoolId, academicYearId, classId: class4eId, subjectId: subClassiquesId, teacherId },
      { schoolId, academicYearId, classId: class4eId, subjectId: subAllemandId, teacherId },
    ],
  });

  // Programme manuel préexistant en Français 6e (ne doit JAMAIS être écrasé)
  const manuelFr = await prismaTest.programme.create({
    data: {
      schoolId,
      academicYearId,
      classId: class6eId,
      subjectId: subFrancaisId,
      level: '6e',
      titre: 'Programme Manuel Français 6e',
      source: 'manuel',
    },
  });
  manualFrProgId = manuelFr.id;
  await prismaTest.chapitre.create({
    data: {
      programmeId: manualFrProgId,
      titre: 'Chapitre manuel conservé',
      ordre: 1,
      volumeHeuresPrevu: 4,
      sequenceCibleFin: 1,
    },
  });

  // Progressions nationales de test (isolées sous templateCode unique)
  const offMaths = await prismaTest.officialProgrammeProgression.create({
    data: {
      templateCode,
      level: '6e',
      filiere: 'FR_GENERAL',
      subjectName: 'Mathématiques',
      titre: 'Programme Officiel Mathématiques 6e',
      importChecksum: 'chk_maths_v1',
      source: 'minesec-distance-learning',
      chapitres: [
        { ordre: 1, titre: 'Nombres entiers (v1)', moduleOrdre: 1, moduleTitre: 'Nombres', positionDansModule: 1, numeroAffiche: 'Leçon 1' },
        { ordre: 2, titre: 'Leçon retirée en v2', moduleOrdre: 1, moduleTitre: 'Nombres', positionDansModule: 2, numeroAffiche: 'Leçon 2' },
        { ordre: 3, titre: 'Droites du plan', moduleOrdre: 2, moduleTitre: 'Géométrie', positionDansModule: 1, numeroAffiche: 'Leçon 1' },
      ],
    },
  });
  offMaths6eId = offMaths.id;
  createdOfficialIds.push(offMaths.id);

  const others = await Promise.all([
    prismaTest.officialProgrammeProgression.create({
      data: {
        templateCode,
        level: '6e',
        filiere: 'FR_GENERAL',
        subjectName: 'Français',
        titre: 'Programme Officiel Français 6e',
        importChecksum: 'chk_fr_v1',
        chapitres: [{ ordre: 1, titre: 'Phrase simple', moduleOrdre: 1, moduleTitre: 'M1', positionDansModule: 1 }],
      },
    }),
    prismaTest.officialProgrammeProgression.create({
      data: {
        templateCode,
        level: '6e',
        filiere: 'FR_GENERAL',
        subjectName: 'Latin',
        titre: 'Programme Officiel Latin 6e',
        importChecksum: 'chk_lat6_v1',
        chapitres: [{ ordre: 1, titre: '1ère déclinaison', moduleOrdre: 1, moduleTitre: 'Vie quotidienne', positionDansModule: 1 }],
      },
    }),
    prismaTest.officialProgrammeProgression.create({
      data: {
        templateCode,
        level: '6e',
        filiere: 'FR_PEBS',
        subjectName: 'Intensive English',
        titre: 'Official Intensive English 6e PEBS',
        importChecksum: 'chk_ie6_v1',
        chapitres: [{ ordre: 1, titre: 'Greetings & Literature awareness', moduleOrdre: 1, moduleTitre: 'Family', positionDansModule: 1 }],
      },
    }),
    prismaTest.officialProgrammeProgression.create({
      data: {
        templateCode,
        level: '6e',
        filiere: 'FR_GENERAL',
        subjectName: 'Travail Manuel',
        titre: 'Programme Officiel Travail Manuel 6e',
        importChecksum: 'chk_tm6_v1',
        chapitres: [
          { ordre: 1, titre: 'Agriculture L1', moduleOrdre: 1, moduleTitre: 'Atelier Agriculture', positionDansModule: 1 },
          { ordre: 2, titre: 'Agriculture L2', moduleOrdre: 1, moduleTitre: 'Atelier Agriculture', positionDansModule: 2 },
          { ordre: 3, titre: 'Élevage L1', moduleOrdre: 2, moduleTitre: 'Atelier Élevage', positionDansModule: 1 },
          { ordre: 4, titre: 'Couture L1', moduleOrdre: 3, moduleTitre: 'Atelier Couture', positionDansModule: 1 },
        ],
      },
    }),
    prismaTest.officialProgrammeProgression.create({
      data: {
        templateCode,
        level: '4e',
        filiere: 'FR_GENERAL',
        subjectName: 'Latin',
        titre: 'Programme Officiel Latin 4e',
        importChecksum: 'chk_lat4_v1',
        chapitres: [{ ordre: 1, titre: '3e déclinaison', moduleOrdre: 1, moduleTitre: 'M1', positionDansModule: 1 }],
      },
    }),
    prismaTest.officialProgrammeProgression.create({
      data: {
        templateCode,
        level: '4e',
        filiere: 'FR_GENERAL',
        subjectName: 'Grec',
        titre: 'Programme Officiel Grec 4e',
        importChecksum: 'chk_gr4_v1',
        chapitres: [{ ordre: 1, titre: 'Alphabet grec', moduleOrdre: 1, moduleTitre: 'M1', positionDansModule: 1 }],
      },
    }),
    prismaTest.officialProgrammeProgression.create({
      data: {
        templateCode,
        level: '4e',
        filiere: 'FR_GENERAL',
        subjectName: 'Allemand',
        titre: 'Programme Officiel Allemand 4e',
        importChecksum: 'chk_de4_v1',
        chapitres: [{ ordre: 1, titre: 'Hallo und Begrüßung', moduleOrdre: 1, moduleTitre: 'M1', positionDansModule: 1 }],
      },
    }),
  ]);
  for (const o of others) createdOfficialIds.push(o.id);
});

afterAll(async () => {
  if (schoolId) {
    await nettoyerEcole(prismaTest, schoolId);
  }
  if (createdOfficialIds.length > 0) {
    await prismaTest.officialProgrammeProgression.deleteMany({
      where: { id: { in: createdOfficialIds } },
    });
  }
  await prismaTest.schoolTemplate.deleteMany({ where: { code: templateCode } });
  await prismaTest.$disconnect();
});

describe('Intégration PostgreSQL locale (zekoulabia_test) — Matérialisation, Coches, Modules, Sync & Rapport', () => {
  it('1. PrismaMaterialisationProgrammeRepository : init 6e/4e (Latin/Grec, Allemand, Intensive English), idempotence & préservation manuel', async () => {
    // 6e : Français manuel ignoré ; Maths, Latin (via Lettres classiques), Intensive English (via pebsMixte), Travail Manuel créés
    const prop6e = await proposerInit.execute({ schoolId, classId: class6eId });
    expect(prop6e.aCreer.map((x) => x.subjectNameNational).sort()).toEqual([
      'Intensive English',
      'Latin',
      'Mathématiques',
      'Travail Manuel',
    ]);
    expect(prop6e.ignores.map((x) => x.subjectId)).toEqual([subFrancaisId]);

    const app1 = await appliquerInit.execute({ schoolId, classId: class6eId });
    expect(app1.totalCrees).toBe(4);
    expect(app1.totalLeconsCreees).toBe(9);

    // Relance idempotente → 0 création, 0 doublon
    const app2 = await appliquerInit.execute({ schoolId, classId: class6eId });
    expect(app2.totalCrees).toBe(0);
    expect(app2.totalLeconsCreees).toBe(0);

    const progs6e = await prismaTest.programme.findMany({
      where: { schoolId, classId: class6eId },
      include: { chapitres: true },
    });
    expect(progs6e).toHaveLength(5); // 1 manuel + 4 nationaux

    // Le programme manuel de Français est strictement intact
    const frApres = progs6e.find((p) => p.id === manualFrProgId)!;
    expect(frApres.source).toBe('manuel');
    expect(frApres.titre).toBe('Programme Manuel Français 6e');
    expect(frApres.chapitres[0].volumeHeuresPrevu).toBe(4);

    // Les chapitres nationaux ont bien volumeHeuresPrevu = null et sourceKey renseigné
    const mathsProg = progs6e.find((p) => p.subjectId === subMathsId)!;
    expect(mathsProg.source).toBe('national');
    expect(mathsProg.chapitres.every((c) => c.volumeHeuresPrevu === null)).toBe(true);
    expect(mathsProg.chapitres.map((c) => c.sourceKey).sort()).toEqual(['1:1', '1:2', '2:1']);

    // 4e : Lettres classiques demande choix Latin/Grec ; Allemand résolu directement
    const prop4e = await proposerInit.execute({ schoolId, classId: class4eId });
    expect(prop4e.choixRequis).toHaveLength(1);
    expect(prop4e.choixRequis[0].options).toEqual(['Latin', 'Grec']);
    expect(prop4e.aCreer.map((x) => x.subjectNameNational)).toEqual(['Allemand']);

    const app4e = await appliquerInit.execute({
      schoolId,
      classId: class4eId,
      optionsClassiques: { [subClassiquesId]: 'Grec' },
    });
    expect(app4e.totalCrees).toBe(2);
    const progs4e = await prismaTest.programme.findMany({ where: { schoolId, classId: class4eId } });
    expect(progs4e.map((p) => p.titre).sort()).toEqual([
      'Programme Officiel Allemand 4e',
      'Programme Officiel Grec 4e',
    ]);
  });

  it('2. PrismaChapitreAvancementRepository & Bascule module : unicité SQL, coche/décoche + cahier, désactivation 2 ateliers TM', async () => {
    const mathsProg = (await prismaTest.programme.findFirst({
      where: { schoolId, classId: class6eId, subjectId: subMathsId },
      include: { chapitres: { orderBy: { ordre: 'asc' } } },
    }))!;
    const [ch1, ch2] = mathsProg.chapitres;

    // Coche directe sur ch1
    const res1 = await basculerAvancement.execute({
      schoolId,
      userId: teacherId,
      role: 'TEACHER',
      chapitreId: ch1.id,
      classId: class6eId,
      fait: true,
    });
    expect(res1.sourceRealisation).toBe('COCHE');

    // Contrainte d'unicité réelle PostgreSQL @@unique([classId, chapitreId]) → rejet P2002
    let duplicateErrorCode: string | undefined;
    try {
      await prismaTest.chapitreAvancement.create({
        data: {
          schoolId,
          classId: class6eId,
          chapitreId: ch1.id,
          academicYearId,
          statut: 'FAIT',
          cocheParId: teacherId,
        },
      });
    } catch (err) {
      duplicateErrorCode = (err as { code?: string }).code;
    }
    expect(duplicateErrorCode).toBe('P2002');

    // Coexistence avec CahierDeTexte sur ch2 : coche + cahier → LES_DEUX, puis décoche → CAHIER
    await prismaTest.cahierDeTexte.create({
      data: {
        schoolId,
        teacherId,
        classId: class6eId,
        subjectId: subMathsId,
        academicYearId,
        chapitreId: ch2.id,
        contenuRealise: 'Séance ch2',
      },
    });
    const resBoth = await basculerAvancement.execute({
      schoolId,
      userId: teacherId,
      role: 'TEACHER',
      chapitreId: ch2.id,
      classId: class6eId,
      fait: true,
    });
    expect(resBoth.sourceRealisation).toBe('LES_DEUX');

    const resUncheck = await basculerAvancement.execute({
      schoolId,
      userId: teacherId,
      role: 'TEACHER',
      chapitreId: ch2.id,
      classId: class6eId,
      fait: false,
    });
    expect(resUncheck.cocheDirecte).toBe(false);
    expect(resUncheck.realise).toBe(true);
    expect(resUncheck.sourceRealisation).toBe('CAHIER');

    // Bascule de modules sur Travail Manuel : désactiver ateliers 2 et 3, cocher 1 leçon sur 2 de l'atelier 1 → 50%
    const tmProg = (await prismaTest.programme.findFirst({
      where: { schoolId, classId: class6eId, subjectId: subTmId },
      include: { chapitres: { orderBy: { ordre: 'asc' } } },
    }))!;
    await basculerAvancement.execute({
      schoolId,
      userId: teacherId,
      role: 'TEACHER',
      chapitreId: tmProg.chapitres[0].id,
      classId: class6eId,
      fait: true,
    });
    await basculerModule.execute({
      schoolId,
      userId: teacherId,
      role: 'TEACHER',
      programmeId: tmProg.id,
      moduleOrdre: 2,
      actif: false,
    });
    await basculerModule.execute({
      schoolId,
      userId: teacherId,
      role: 'TEACHER',
      programmeId: tmProg.id,
      moduleOrdre: 3,
      actif: false,
    });

    const progTm = await calculerProgression.calculerProgression({
      schoolId,
      classId: class6eId,
      subjectId: subTmId,
    });
    expect(progTm.leconsTotal).toBe(2);
    expect(progTm.leconsRealisees).toBe(1);
    expect(progTm.progressionPct).toBe(50);
    expect(progTm.modulesDesactivesCount).toBe(2);
    expect(progTm.hasHeuresPrevu).toBe(false);
    expect(progTm.totalHeuresPrevu).toBeNull();
  });

  it('3. PrismaSynchronisationProgrammeRepository : mise à jour en place (IDs/coches préservés), ajout, retrait conservé & rollback atomique', async () => {
    const mathsProgAvant = (await prismaTest.programme.findFirst({
      where: { schoolId, classId: class6eId, subjectId: subMathsId },
      include: { chapitres: { orderBy: { ordre: 'asc' } } },
    }))!;
    const ch1IdAvant = mathsProgAvant.chapitres.find((c) => c.sourceKey === '1:1')!.id;
    const ch2IdAvant = mathsProgAvant.chapitres.find((c) => c.sourceKey === '1:2')!.id;

    // Évolution de la progression nationale en base (v2) : 1:1 renommée, 1:2 retirée, 2:2 ajoutée
    await prismaTest.officialProgrammeProgression.update({
      where: { id: offMaths6eId },
      data: {
        importChecksum: 'chk_maths_v2',
        titre: 'Programme Officiel Mathématiques 6e (v2)',
        chapitres: [
          { ordre: 1, titre: 'Nombres entiers naturels (v2)', moduleOrdre: 1, moduleTitre: 'Nombres', positionDansModule: 1, numeroAffiche: 'Leçon 1' },
          { ordre: 2, titre: 'Droites du plan', moduleOrdre: 2, moduleTitre: 'Géométrie', positionDansModule: 1, numeroAffiche: 'Leçon 1' },
          { ordre: 3, titre: 'Angles et triangles (nouvelle)', moduleOrdre: 2, moduleTitre: 'Géométrie', positionDansModule: 2, numeroAffiche: 'Leçon 2' },
        ],
      },
    });

    const derives = await listerDerives.execute({ schoolId });
    expect(derives.totalAvecDerive).toBe(1);
    expect(derives.derives[0].programmeId).toBe(mathsProgAvant.id);

    const preview = await proposerSync.execute({ schoolId, programmeId: mathsProgAvant.id });
    expect(preview.diff.ajoutes).toHaveLength(1);
    expect(preview.diff.modifies.map((m) => m.chapitreId)).toContain(ch1IdAvant);
    expect(preview.diff.retiresDuNational.map((r) => r.chapitreId)).toEqual([ch2IdAvant]);
    expect(preview.diff.retiresDuNational[0].utilisee).toBe(true);

    // Preuve d'atomicité / rollback PostgreSQL : si une écriture échoue dans la transaction, RIEN ne persiste
    await expect(
      syncRepo.appliquerSynchronisationAtomique({
        schoolId,
        programmeId: mathsProgAvant.id,
        officialProgressionId: offMaths6eId,
        nouveauTitre: 'NE DOIT PAS PERSISTER',
        nouveauChecksum: 'chk_broken',
        ajoutes: preview.diff.ajoutes,
        modifies: [
          {
            ...preview.diff.modifies[0],
            chapitreId: 'chapitre_inexistant_pour_forcer_rollback',
          },
        ],
      }),
    ).rejects.toThrow();

    const apresRollback = (await prismaTest.programme.findUnique({
      where: { id: mathsProgAvant.id },
      include: { chapitres: true },
    }))!;
    expect(apresRollback.titre).toBe('Programme Officiel Mathématiques 6e');
    expect(apresRollback.sourceChecksum).toBe('chk_maths_v1');
    expect(apresRollback.chapitres).toHaveLength(3);

    // Synchronisation réelle réussie
    const synced1 = await appliquerSync.execute({ schoolId, programmeId: mathsProgAvant.id });
    expect(synced1.dejaAJour).toBe(false);
    expect(synced1.nbAjoutes).toBe(1);
    expect(synced1.nbConservesRetiresDuNational).toBe(1);

    const apresSync = (await prismaTest.programme.findUnique({
      where: { id: mathsProgAvant.id },
      include: { chapitres: true },
    }))!;
    expect(apresSync.sourceChecksum).toBe('chk_maths_v2');
    expect(apresSync.chapitres).toHaveLength(4); // 3 conservés + 1 ajouté (ch2 jamais supprimé !)
    expect(apresSync.chapitres.find((c) => c.id === ch1IdAvant)?.titre).toBe('Nombres entiers naturels (v2)');

    // La coche directe sur ch1IdAvant et le cahier sur ch2IdAvant sont toujours là en base !
    const avCh1 = await prismaTest.chapitreAvancement.findUnique({
      where: { classId_chapitreId: { classId: class6eId, chapitreId: ch1IdAvant } },
    });
    expect(avCh1).not.toBeNull();
    const cahCh2 = await prismaTest.cahierDeTexte.count({ where: { chapitreId: ch2IdAvant } });
    expect(cahCh2).toBe(1);

    // Idempotence : 2e synchro → dejaAJour = true et plus aucune dérive signalée
    const synced2 = await appliquerSync.execute({ schoolId, programmeId: mathsProgAvant.id });
    expect(synced2.dejaAJour).toBe(true);
    const derivesApres = await listerDerives.execute({ schoolId });
    expect(derivesApres.totalAvecDerive).toBe(0);
  });

  it('4. Rapport consolidé, scoping AP département, export CSV & défaut 2h sur PrismaChapitreRepository', async () => {
    // Vérification défaut 2h sur création directe manuelle (Chantier 2 sur vraie DB après DROP DEFAULT)
    const createdDirect = await chapRepo.create({
      programmeId: manualFrProgId,
      titre: 'Chapitre direct sans heure',
      ordre: 2,
      volumeHeuresPrevu: undefined as unknown as number | null,
      sequenceCibleFin: null,
    });
    expect(createdDirect.volumeHeuresPrevu).toBe(2);

    // Rapport Admin : toutes les matières de 6e et 4e
    const rapportAdmin = await genererRapport.execute({
      schoolId,
      userId: 'admin_test',
      role: 'ADMIN',
      permissions: [],
    });
    expect(rapportAdmin.resumeGlobal.totalProgrammes).toBe(7); // 5 en 6e + 2 en 4e
    expect(rapportAdmin.resumeGlobal.totalModulesDesactives).toBe(2);
    expect(rapportAdmin.parNiveau.map((n) => n.libelle).sort()).toEqual(['4e', '6e']);

    // Rapport AP Maths : voit UNIQUEMENT Mathématiques (0 Français, 0 Allemand, 0 Travail Manuel)
    const rapportAp = await genererRapport.execute({
      schoolId,
      userId: apMathsId,
      role: 'TEACHER',
      permissions: [],
    });
    expect(rapportAp.lignes).toHaveLength(1);
    expect(rapportAp.lignes[0].subjectId).toBe(subMathsId);

    const csv = formaterRapportAvancementCsv(rapportAdmin);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Mathématiques');
    expect(csv).toContain('Travail Manuel');
    expect(csv).toContain(';2;'); // 2 modules désactivés sur Travail Manuel
  });
});
