/**
 * Tests de `ActiverEtablissementUseCase` — zone à risque n°5 de l'audit.
 *
 * 1073 lignes, pivot du jalon V0.6 et de tout l'onboarding V2.1 : une transaction unique qui
 * crée l'année scolaire, les périodes, les séquences, les classes, les matières, les
 * coefficients et la configuration d'un établissement. Un seul test existait
 * (`activerEtablissement.integration.test.ts`) et ne vérifiait qu'un point précis — le stampage
 * d'`academicYearId` sur les classes — parce qu'il avait été écrit en marge du nettoyage des
 * casts, pas pour couvrir ce use case.
 *
 * Ce fichier couvre le CŒUR : structure réellement générée, gardes d'entrée, et surtout
 * l'ATOMICITÉ (une activation qui échoue ne doit rien laisser derrière elle) et la
 * NON-RÉENTRANCE (activer deux fois ne doit pas dupliquer la structure).
 *
 * Prérequis : référentiel curriculaire seedé dans zekoulabia_test
 * (`bunx prisma db seed`), sinon LYCEE_FR n'a aucun coefficient et l'activation échoue en amont.
 */
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import type { Prisma } from '@prisma/client';
import { ActiverEtablissementUseCase } from '../../../../src/application/school/ActiverEtablissementUseCase.ts';
import { PrismaSchoolActivationRepository } from '../../../../src/infrastructure/persistence/prisma/PrismaSchoolActivationRepository.ts';
import { prismaTest } from '../../../helpers/prismaTestClient.ts';
import { nettoyerEcole } from '../../../helpers/dbFixtures.ts';

const useCase = new ActiverEtablissementUseCase(new PrismaSchoolActivationRepository(prismaTest));
const ecolesCreees: string[] = [];

/** Crée une école APPROVED prête à être activée, avec la config d'onboarding fournie. */
async function creerEcoleApprouvee(
  label: string,
  onboardingConfig: Prisma.InputJsonValue,
  overrides: { status?: string; templateCode?: string } = {},
) {
  const school = await prismaTest.school.create({
    data: {
      name: `École ${label}`,
      subdomain: `activ-${label}-${Date.now()}`,
      status: (overrides.status ?? 'APPROVED') as 'APPROVED',
      subsystem: 'FRANCOPHONE',
      templateCode: overrides.templateCode ?? 'LYCEE_FR',
      onboardingConfig,
    },
  });
  ecolesCreees.push(school.id);
  return school;
}

/**
 * Niveaux écrits `6e`/`5e` — exactement ce que le wizard d'onboarding envoie
 * (`ConversationalOnboarding.tsx:245`) et ce que porte le référentiel curriculaire
 * (`CycleCoefficient.classLevel`). Un libellé approchant comme `6ème` produirait une activation
 * silencieusement vide de matières : les classes seraient créées, mais aucune correspondance ne
 * serait trouvée dans le référentiel. C'est précisément ce que le test « matières » ci-dessous
 * verrouille.
 */
const CONFIG_BASE = {
  templateCode: 'LYCEE_FR',
  academicYearStart: '2025-09-01',
  academicYearEnd: '2026-06-30',
  niveaux1erCycle: ['6e', '5e'],
  classesParNiveau: { '6e': 2, '5e': 1 },
  conventionNommage: 'LETTRES',
};

async function nettoyerStructure(schoolId: string) {
  await prismaTest.class.deleteMany({ where: { schoolId } });
  await prismaTest.subjectCoefficient.deleteMany({ where: { schoolId } });
  await prismaTest.classSubjectOverride.deleteMany({ where: { schoolId } });
  await prismaTest.department.deleteMany({ where: { schoolId } });
  await prismaTest.subject.deleteMany({ where: { schoolId } });
  await prismaTest.gradeFormula.deleteMany({ where: { schoolId } });
  await prismaTest.mentionRule.deleteMany({ where: { schoolId } });
  await prismaTest.schoolConfig.deleteMany({ where: { schoolId } });
  await prismaTest.schoolSettings.deleteMany({ where: { schoolId } });
  await prismaTest.academicSequence.deleteMany({ where: { schoolId } });
  await prismaTest.academicPeriod.deleteMany({ where: { academicYear: { schoolId } } });
  await prismaTest.academicYear.deleteMany({ where: { schoolId } });
}

beforeAll(async () => {
  const template = await prismaTest.schoolTemplate.findUnique({ where: { code: 'LYCEE_FR' } });
  if (!template) {
    throw new Error(
      "SchoolTemplate 'LYCEE_FR' introuvable dans zekoulabia_test — lancez d'abord : " +
      'DATABASE_URL doit être défini vers la base de test avant : bunx prisma db seed',
    );
  }
});

afterAll(async () => {
  for (const schoolId of ecolesCreees) {
    await nettoyerStructure(schoolId);
    await prismaTest.user.deleteMany({ where: { schoolId } });
    await nettoyerEcole(prismaTest, schoolId).catch(() => { /* déjà supprimée */ });
  }
  await prismaTest.$disconnect();
});

describe('ActiverEtablissementUseCase — gardes d\'entrée', () => {
  it('école introuvable → rejet explicite', async () => {
    await expect(useCase.execute({ schoolId: 'ecole-inexistante' })).rejects.toThrow('introuvable');
  });

  it("une école NON approuvée ne peut pas être activée, et rien n'est créé", async () => {
    const school = await creerEcoleApprouvee('pending', CONFIG_BASE, { status: 'PENDING' });

    await expect(useCase.execute({ schoolId: school.id })).rejects.toThrow('approuvé');

    // Aucune structure n'a été amorcée avant le refus.
    expect(await prismaTest.academicYear.count({ where: { schoolId: school.id } })).toBe(0);
    expect(await prismaTest.class.count({ where: { schoolId: school.id } })).toBe(0);
    expect(await prismaTest.subject.count({ where: { schoolId: school.id } })).toBe(0);
  });
});

describe('ActiverEtablissementUseCase — structure réellement générée', () => {
  let schoolId: string;
  let resultat: Awaited<ReturnType<typeof useCase.execute>>;

  beforeAll(async () => {
    const school = await creerEcoleApprouvee('structure', CONFIG_BASE);
    schoolId = school.id;
    resultat = await useCase.execute({ schoolId });
  });

  it("crée l'année scolaire, courante, aux dates de l'onboarding", async () => {
    const annees = await prismaTest.academicYear.findMany({ where: { schoolId } });
    expect(annees).toHaveLength(1);
    expect(annees[0]!.isCurrent).toBe(true);
    expect(annees[0]!.status).toBe('ACTIVE');
    expect(annees[0]!.startDate.toISOString()).toStartWith('2025-09-01');
    expect(resultat.academicYear).toBe(annees[0]!.name);
  });

  it('crée les périodes rattachées à cette année, et des séquences dans chacune', async () => {
    const periodes = await prismaTest.academicPeriod.findMany({
      where: { academicYear: { schoolId } }, include: { sequences: true },
    });
    expect(periodes.length).toBeGreaterThan(0);
    // Chaque période porte au moins une séquence — sinon la saisie de notes est impossible.
    for (const p of periodes) expect(p.sequences.length).toBeGreaterThan(0);
    // Exactement une période courante.
    expect(periodes.filter(p => p.isCurrent)).toHaveLength(1);
  });

  it('crée le bon NOMBRE de classes, nommées selon la convention, toutes year-scopées', async () => {
    const classes = await prismaTest.class.findMany({ where: { schoolId } });
    // classesParNiveau : 6ème ×2 + 5ème ×1
    expect(classes).toHaveLength(3);
    expect(resultat.classCount).toBe(3);

    const noms = classes.map(c => c.name).sort();
    expect(noms).toEqual(['5e A', '6e A', '6e B']);

    // Toutes rattachées à l'année créée dans la MÊME transaction (régression du bug historique).
    const annee = await prismaTest.academicYear.findFirstOrThrow({ where: { schoolId } });
    expect(classes.every(c => c.academicYearId === annee.id)).toBe(true);
  });

  it('crée les matières et leurs coefficients depuis le référentiel curriculaire', async () => {
    const matieres = await prismaTest.subject.findMany({ where: { schoolId } });
    expect(matieres.length).toBeGreaterThan(0);
    expect(resultat.subjectCount).toBe(matieres.length);

    const coefficients = await prismaTest.subjectCoefficient.findMany({ where: { schoolId } });
    expect(coefficients.length).toBeGreaterThan(0);
  });

  it('crée la configuration de l\'école avec un seuil de réussite cohérent', async () => {
    const config = await prismaTest.schoolConfig.findFirst({ where: { schoolId } });
    expect(config).not.toBeNull();
    // Notation sur 20 (défaut francophone) → passMark 10, jamais 50.
    expect(config!.passMark).toBe(10);
  });

  it("bascule le statut de l'école en ACTIVE", async () => {
    const school = await prismaTest.school.findUniqueOrThrow({ where: { id: schoolId } });
    expect(school.status).toBe('ACTIVE');
  });
});

describe('ActiverEtablissementUseCase — atomicité et réentrance', () => {
  it("ATOMICITÉ — un échec TARDIF annule tout ce qui a déjà été écrit dans la transaction", async () => {
    const school = await creerEcoleApprouvee('atomicite', CONFIG_BASE);

    // `SchoolConfig.schoolId` est @unique : en en créant un AVANT l'activation, on fait échouer
    // l'étape 7 de la transaction — donc APRÈS la création de l'année, des périodes, des
    // séquences, des classes et des matières. C'est le pire cas pour l'atomicité : beaucoup de
    // lignes déjà écrites au moment où ça casse.
    await prismaTest.schoolConfig.create({ data: { schoolId: school.id } });

    await expect(useCase.execute({ schoolId: school.id })).rejects.toThrow();

    // Rien de ce que la transaction avait commencé à écrire ne doit subsister.
    expect(await prismaTest.academicYear.count({ where: { schoolId: school.id } })).toBe(0);
    expect(await prismaTest.academicPeriod.count({ where: { academicYear: { schoolId: school.id } } })).toBe(0);
    expect(await prismaTest.class.count({ where: { schoolId: school.id } })).toBe(0);
    expect(await prismaTest.subject.count({ where: { schoolId: school.id } })).toBe(0);

    // Et surtout : l'école ne doit PAS être marquée ACTIVE, sinon elle serait définitivement
    // bloquée — ni activable (statut ≠ APPROVED), ni pourvue d'une structure.
    const apres = await prismaTest.school.findUniqueOrThrow({ where: { id: school.id } });
    expect(apres.status).toBe('APPROVED');
  });

  it("RÉENTRANCE — réactiver une école déjà ACTIVE est refusé (pas de structure dupliquée)", async () => {
    const school = await creerEcoleApprouvee('reentrance', CONFIG_BASE);
    await useCase.execute({ schoolId: school.id });

    const classesApres1 = await prismaTest.class.count({ where: { schoolId: school.id } });
    const anneesApres1 = await prismaTest.academicYear.count({ where: { schoolId: school.id } });

    // L'école est désormais ACTIVE : la garde d'entrée (statut ≠ APPROVED) doit la protéger.
    await expect(useCase.execute({ schoolId: school.id })).rejects.toThrow('approuvé');

    // Rien n'a été dupliqué.
    expect(await prismaTest.class.count({ where: { schoolId: school.id } })).toBe(classesApres1);
    expect(await prismaTest.academicYear.count({ where: { schoolId: school.id } })).toBe(anneesApres1);
  });
});
