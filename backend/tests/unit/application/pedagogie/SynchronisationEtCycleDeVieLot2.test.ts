import { afterEach, describe, expect, it } from 'bun:test';
import { ListerDerivesProgrammesEcoleUseCase } from '@application/pedagogie/ListerDerivesProgrammesEcoleUseCase';
import { ProposerSynchronisationProgrammeUseCase } from '@application/pedagogie/ProposerSynchronisationProgrammeUseCase';
import { AppliquerSynchronisationProgrammeUseCase } from '@application/pedagogie/AppliquerSynchronisationProgrammeUseCase';
import { InitialiserProgrammesEcoleUseCase } from '@application/pedagogie/InitialiserProgrammesEcoleUseCase';
import { PedagogieValidationError } from '@application/pedagogie/errors';
import { FeatureFlaggedAutoMaterialisationService } from '@infrastructure/services/pedagogie/FeatureFlaggedAutoMaterialisationService';
import { OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG } from '@infrastructure/config/featureFlags';
import type {
  AppliquerSyncAtomiqueInput,
  ProgrammeNationalPourSync,
  SynchronisationProgrammeRepository,
} from '@domain/ports/repositories/SynchronisationProgrammeRepository';
import type { ProposerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/ProposerInitialisationProgrammesClasseUseCase';
import type { AppliquerInitialisationProgrammesClasseUseCase } from '@application/pedagogie/AppliquerInitialisationProgrammesClasseUseCase';

class InMemorySyncRepo implements SynchronisationProgrammeRepository {
  public appelsApply = 0;

  constructor(
    public programmes: ProgrammeNationalPourSync[],
    public classesActives: Array<{ id: string; name: string; level: string | null; academicYearId: string }> = [],
  ) {}

  async listerClassesActivesEcole() {
    return this.classesActives;
  }

  async listerProgrammesNationauxAvecReference(schoolId: string) {
    return this.programmes.filter((p) => p.schoolId === schoolId && p.source === 'national');
  }

  async findProgrammePourSynchronisation(schoolId: string, programmeId: string) {
    return this.programmes.find((p) => p.schoolId === schoolId && p.id === programmeId) ?? null;
  }

  async appliquerSynchronisationAtomique(input: AppliquerSyncAtomiqueInput) {
    this.appelsApply += 1;
    const target = this.programmes.find((p) => p.id === input.programmeId)!;
    target.titre = input.nouveauTitre;
    target.sourceChecksum = input.nouveauChecksum;

    for (const mod of input.modifies) {
      const ch = target.chapitresEcole.find((c) => c.id === mod.chapitreId);
      if (ch) {
        ch.titre = mod.apres.titre;
        ch.ordre = mod.apres.ordre;
        ch.moduleOrdre = mod.apres.moduleOrdre;
        ch.moduleTitre = mod.apres.moduleTitre;
        ch.positionDansModule = mod.apres.positionDansModule;
        ch.numeroAffiche = mod.apres.numeroAffiche;
        ch.sourceUrl = mod.apres.sourceUrl;
        ch.sourceKey = mod.apres.sourceKey;
      }
    }

    for (const add of input.ajoutes) {
      target.chapitresEcole.push({
        id: `ch_new_${target.chapitresEcole.length + 1}`,
        titre: add.titre,
        ordre: add.ordre,
        volumeHeuresPrevu: add.volumeHeuresPrevu,
        sequenceCibleFin: add.sequenceCibleFin,
        moduleOrdre: add.moduleOrdre,
        moduleTitre: add.moduleTitre,
        positionDansModule: add.positionDansModule,
        numeroAffiche: add.numeroAffiche,
        sourceUrl: add.sourceUrl,
        sourceKey: add.sourceKey,
        nbSeancesCahier: 0,
        nbCochesDirectes: 0,
      });
    }

    let nbMarquesRetires = 0;
    for (const id of input.retiresAMarquer) {
      const ch = target.chapitresEcole.find((c) => c.id === id);
      if (ch && !ch.retireDuReferentielLe) {
        ch.retireDuReferentielLe = new Date();
        nbMarquesRetires += 1;
      }
    }

    return {
      programmeId: input.programmeId,
      nbAjoutes: input.ajoutes.length,
      nbModifies: input.modifies.length,
      nbMarquesRetires,
      nouveauChecksum: input.nouveauChecksum,
    };
  }
}

function makeProgrammeDerive(): ProgrammeNationalPourSync {
  return {
    id: 'prog_1',
    schoolId: 'sch_1',
    subjectId: 'sub_maths',
    subjectName: 'Mathématiques',
    classId: 'cls_6e1',
    className: '6e 1',
    level: '6e',
    filiere: 'FR_GENERAL',
    academicYearId: 'ay_1',
    titre: 'Maths 6e',
    source: 'national',
    sourceChecksum: 'chk_v1',
    officialProgressionId: 'off_maths_6e',
    officialTitre: 'Maths 6e',
    officialChecksum: 'chk_v2',
    officialActive: true,
    chapitresEcole: [
      {
        id: 'ch_existing_1',
        titre: 'Nombres entiers (ancien titre)',
        ordre: 1,
        volumeHeuresPrevu: null,
        sequenceCibleFin: null,
        moduleOrdre: 1,
        moduleTitre: 'Module 1',
        positionDansModule: 1,
        numeroAffiche: 'Leçon 1',
        sourceUrl: null,
        sourceKey: '1:1',
        nbSeancesCahier: 1,
        nbCochesDirectes: 1,
      },
    ],
    chapitresOfficiels: [
      {
        ordre: 1,
        titre: 'Nombres entiers naturels',
        volumeHeuresPrevu: null,
        sequenceCibleFin: null,
        moduleOrdre: 1,
        moduleTitre: 'Module 1',
        positionDansModule: 1,
        numeroAffiche: 'Leçon 1',
        sourceUrl: 'https://example.test/l1',
        sourceKey: '1:1',
      },
      {
        ordre: 2,
        titre: 'Droites et segments',
        volumeHeuresPrevu: null,
        sequenceCibleFin: null,
        moduleOrdre: 1,
        moduleTitre: 'Module 1',
        positionDansModule: 2,
        numeroAffiche: 'Leçon 2',
        sourceUrl: null,
        sourceKey: '1:2',
      },
    ],
  };
}

describe('Lot 2 — Détection de dérive, sync non destructive, init école et auto-matérialisation', () => {
  const originalFlag = process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG];

  afterEach(() => {
    if (originalFlag === undefined) delete process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG];
    else process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG] = originalFlag;
  });

  it('détecte les dérives, prévisualise sans écriture, applique en place en préservant les IDs/coches, puis est idempotent', async () => {
    const prog = makeProgrammeDerive();
    const repo = new InMemorySyncRepo([prog]);

    const lister = new ListerDerivesProgrammesEcoleUseCase(repo);
    const derivesAvant = await lister.execute({ schoolId: 'sch_1' });
    expect(derivesAvant.totalAvecDerive).toBe(1);
    expect(derivesAvant.derives[0].ajoutesCount).toBe(1);
    expect(derivesAvant.derives[0].modifiesCount).toBe(1);

    const proposer = new ProposerSynchronisationProgrammeUseCase(repo);
    const preview = await proposer.execute({ schoolId: 'sch_1', programmeId: 'prog_1' });
    expect(repo.appelsApply).toBe(0);
    expect(preview.diff.aDerive).toBe(true);

    const appliquer = new AppliquerSynchronisationProgrammeUseCase(repo);
    const res1 = await appliquer.execute({ schoolId: 'sch_1', programmeId: 'prog_1' });
    expect(res1.dejaAJour).toBe(false);
    expect(res1.nbAjoutes).toBe(1);
    expect(res1.nbModifies).toBe(1);
    expect(repo.appelsApply).toBe(1);

    // L'ID, les coches et les cahiers de texte de ch_existing_1 sont strictement intacts
    const ch1 = prog.chapitresEcole.find((c) => c.id === 'ch_existing_1');
    expect(ch1?.titre).toBe('Nombres entiers naturels');
    expect(ch1?.nbCochesDirectes).toBe(1);
    expect(ch1?.nbSeancesCahier).toBe(1);

    // 2e exécution → idempotente (dejaAJour = true, 0 écriture)
    const res2 = await appliquer.execute({ schoolId: 'sch_1', programmeId: 'prog_1' });
    expect(res2.dejaAJour).toBe(true);
    expect(repo.appelsApply).toBe(1);

    const derivesApres = await lister.execute({ schoolId: 'sch_1' });
    expect(derivesApres.totalAvecDerive).toBe(0);
  });

  it('refuse la synchronisation sur un programme manuel', async () => {
    const manuel: ProgrammeNationalPourSync = { ...makeProgrammeDerive(), id: 'prog_man', source: 'manuel' };
    const repo = new InMemorySyncRepo([manuel]);
    const proposer = new ProposerSynchronisationProgrammeUseCase(repo);

    await expect(
      proposer.execute({ schoolId: 'sch_1', programmeId: 'prog_man' }),
    ).rejects.toBeInstanceOf(PedagogieValidationError);
  });

  it('InitialiserProgrammesEcoleUseCase agrège dry-run et apply sur toutes les classes actives', async () => {
    const repo = new InMemorySyncRepo([], [
      { id: 'c1', name: '6e A', level: '6e', academicYearId: 'ay_1' },
      { id: 'c2', name: '5e A', level: '5e', academicYearId: 'ay_1' },
    ]);
    let applyCalls = 0;

    const fakeProposer = {
      execute: async (input: { classId: string }) => ({
        classe: {
          id: input.classId,
          name: input.classId === 'c1' ? '6e A' : '5e A',
          level: input.classId === 'c1' ? '6e' : '5e',
          levelNormalise: input.classId === 'c1' ? '6e' : '5e',
          filiere: 'FR_GENERAL',
          serie: null,
          pebsMixte: false,
          academicYearId: 'ay_1',
        },
        resume: { totalMatieres: 2, aCreer: 1, ignores: 1, choixRequis: 0, impossibles: 0, totalLeconsACreer: 40 },
        aCreer: [],
        ignores: [],
        choixRequis: [],
        impossibles: [],
      }),
    } as unknown as ProposerInitialisationProgrammesClasseUseCase;

    const fakeAppliquer = {
      execute: async (input: { classId: string }) => {
        applyCalls += 1;
        return {
          classe: { id: input.classId, name: input.classId, level: '6e', academicYearId: 'ay_1' },
          totalCrees: 1,
          totalLeconsCreees: 40,
          crees: [],
          ignores: [],
          choixRequis: [],
          impossibles: [],
        };
      },
    } as unknown as AppliquerInitialisationProgrammesClasseUseCase;

    const useCase = new InitialiserProgrammesEcoleUseCase(repo, fakeProposer, fakeAppliquer);

    const prop = await useCase.proposer({ schoolId: 'sch_1' });
    expect(applyCalls).toBe(0);
    expect(prop.resume.totalClasses).toBe(2);
    expect(prop.resume.totalProgrammesACreer).toBe(2);
    expect(prop.resume.totalLeconsACreer).toBe(80);

    const app = await useCase.appliquer({ schoolId: 'sch_1' });
    expect(applyCalls).toBe(2);
    expect(app.resume.totalProgrammesCrees).toBe(2);
    expect(app.resume.totalLeconsCreees).toBe(80);
  });

  it('FeatureFlaggedAutoMaterialisationService est no-op quand flag OFF et non bloquant en cas d erreur quand flag ON', async () => {
    let classeCalls = 0;
    let ecoleCalls = 0;

    const failingClasse = {
      execute: async () => {
        classeCalls += 1;
        throw new Error('Erreur simulée non bloquante');
      },
    } as unknown as AppliquerInitialisationProgrammesClasseUseCase;

    const failingEcole = {
      appliquer: async () => {
        ecoleCalls += 1;
        throw new Error('Erreur simulée école');
      },
    } as unknown as InitialiserProgrammesEcoleUseCase;

    const svc = new FeatureFlaggedAutoMaterialisationService(failingClasse, failingEcole);

    // Flag OFF → 0 appel
    delete process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG];
    await svc.materialiserPourClasseSiActif({ schoolId: 'sch_1', classId: 'c1' });
    await svc.materialiserPourEcoleSiActif({ schoolId: 'sch_1' });
    expect(classeCalls).toBe(0);
    expect(ecoleCalls).toBe(0);

    // Flag ON → appelé, mais ne propage JAMAIS l'exception
    process.env[OFFICIAL_PROGRAMMES_MATERIALISATION_FLAG] = 'true';
    await svc.materialiserPourClasseSiActif({ schoolId: 'sch_1', classId: 'c1' });
    await svc.materialiserPourEcoleSiActif({ schoolId: 'sch_1' });
    expect(classeCalls).toBe(1);
    expect(ecoleCalls).toBe(1);
  });
});
