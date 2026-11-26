/**
 * APPLICATION LAYER — Use Case Dry-Run (propose) pour l'initialisation des programmes
 * nationaux d'une classe. Ne réalise AUCUNE écriture en base.
 */
import type {
  MaterialisationProgrammeRepository,
  OfficialProgressionAvecChapitres,
} from '@domain/ports/repositories/MaterialisationProgrammeRepository';
import {
  calculerFilieresCandidates,
  calculerTemplatesCandidats,
  normaliserNiveauPourResolution,
  resoudreProgressionOfficielle,
  type OptionClassique,
} from '@domain/rules/officialProgressionResolution';
import { PedagogieNotFoundError } from './errors';

export interface ProposerInitialisationClasseInput {
  schoolId: string;
  classId: string;
  academicYearId?: string;
  /** Choix explicite Latin/Grec par subjectId pour les classes de 4e/3e avec Lettres classiques. */
  optionsClassiques?: Record<string, OptionClassique>;
}

export interface PropositionACreerItem {
  subjectId: string;
  subjectName: string;
  officialProgressionId: string;
  titre: string;
  filiere: string;
  subjectNameNational: string;
  nbLecons: number;
  nbModules: number;
}

export interface PropositionIgnoreItem {
  subjectId: string;
  subjectName: string;
  programmeExistantId: string;
  programmeExistantTitre: string;
  source: string;
  raison: 'PROGRAMME_MANUEL_EXISTANT' | 'DEJA_INITIALISE';
}

export interface PropositionChoixRequisItem {
  subjectId: string;
  subjectName: string;
  options: OptionClassique[];
  raison: string;
}

export interface PropositionImpossibleItem {
  subjectId: string;
  subjectName: string;
  raison: string;
}

export interface PropositionInitialisationClasseResultat {
  classe: {
    id: string;
    name: string;
    level: string | null;
    levelNormalise: string | null;
    filiere: string | null;
    serie: string | null;
    pebsMixte: boolean;
    academicYearId: string;
  };
  resume: {
    totalMatieres: number;
    aCreer: number;
    ignores: number;
    choixRequis: number;
    impossibles: number;
    totalLeconsACreer: number;
  };
  aCreer: PropositionACreerItem[];
  ignores: PropositionIgnoreItem[];
  choixRequis: PropositionChoixRequisItem[];
  impossibles: PropositionImpossibleItem[];
}

export interface PropositionInterneDetail extends PropositionInitialisationClasseResultat {
  progressionsParSubjectId: Map<string, OfficialProgressionAvecChapitres>;
}

function compterModules(progression: OfficialProgressionAvecChapitres): number {
  const ordres = new Set<number>();
  for (const ch of progression.chapitres) {
    if (ch.moduleOrdre !== null && ch.moduleOrdre !== undefined) {
      ordres.add(ch.moduleOrdre);
    }
  }
  return ordres.size;
}

export class ProposerInitialisationProgrammesClasseUseCase {
  constructor(
    private readonly materialisationRepo: MaterialisationProgrammeRepository,
  ) {}

  async execute(
    input: ProposerInitialisationClasseInput,
  ): Promise<PropositionInitialisationClasseResultat> {
    const detail = await this.evaluerAvecDetails(input);
    return {
      classe: detail.classe,
      resume: detail.resume,
      aCreer: detail.aCreer,
      ignores: detail.ignores,
      choixRequis: detail.choixRequis,
      impossibles: detail.impossibles,
    };
  }

  async evaluerAvecDetails(
    input: ProposerInitialisationClasseInput,
  ): Promise<PropositionInterneDetail> {
    const classe = await this.materialisationRepo.findClassePourMaterialisation(
      input.schoolId,
      input.classId,
      input.academicYearId,
    );
    if (!classe) {
      throw new PedagogieNotFoundError('Classe introuvable');
    }

    const levelNormalise = normaliserNiveauPourResolution(classe.level);
    const ctx = {
      schoolTemplateCode: classe.schoolTemplateCode,
      level: classe.level,
      filiere: classe.filiere,
      serie: classe.serie,
      pebsMixte: classe.pebsMixte,
    };

    const existants = await this.materialisationRepo.findProgrammesExistantsClasse(
      input.schoolId,
      classe.id,
      classe.academicYearId,
    );
    const existantsParSubject = new Map(existants.map((p) => [p.subjectId, p]));

    const templateCodes = calculerTemplatesCandidats(classe.schoolTemplateCode);
    const filieres = calculerFilieresCandidates(ctx);
    const levels = Array.from(
      new Set([classe.level?.trim(), levelNormalise].filter((v): v is string => Boolean(v))),
    );

    const candidates =
      levels.length > 0
        ? await this.materialisationRepo.findOfficialProgressionsCandidates({
            templateCodes,
            levels,
            filieres,
          })
        : [];
    const candidatesById = new Map(candidates.map((c) => [c.id, c]));

    const aCreer: PropositionACreerItem[] = [];
    const ignores: PropositionIgnoreItem[] = [];
    const choixRequis: PropositionChoixRequisItem[] = [];
    const impossibles: PropositionImpossibleItem[] = [];
    const progressionsParSubjectId = new Map<string, OfficialProgressionAvecChapitres>();

    for (const matiere of classe.subjects) {
      const existant = existantsParSubject.get(matiere.id);
      if (existant) {
        ignores.push({
          subjectId: matiere.id,
          subjectName: matiere.name,
          programmeExistantId: existant.id,
          programmeExistantTitre: existant.titre,
          source: existant.source,
          raison:
            existant.source === 'national'
              ? 'DEJA_INITIALISE'
              : 'PROGRAMME_MANUEL_EXISTANT',
        });
        continue;
      }

      const option = input.optionsClassiques?.[matiere.id];
      const resolution = resoudreProgressionOfficielle(ctx, matiere.name, candidates, option);

      if (resolution.statut === 'RESOLU') {
        const complete = candidatesById.get(resolution.progression.id);
        if (!complete || complete.chapitres.length === 0) {
          impossibles.push({
            subjectId: matiere.id,
            subjectName: matiere.name,
            raison: 'Progression nationale sans leçon exploitable.',
          });
          continue;
        }
        progressionsParSubjectId.set(matiere.id, complete);
        aCreer.push({
          subjectId: matiere.id,
          subjectName: matiere.name,
          officialProgressionId: complete.id,
          titre: complete.titre,
          filiere: resolution.filiereResolue,
          subjectNameNational: resolution.subjectNameResolu,
          nbLecons: complete.chapitres.length,
          nbModules: compterModules(complete),
        });
        continue;
      }

      if (resolution.statut === 'CHOIX_REQUIS') {
        choixRequis.push({
          subjectId: matiere.id,
          subjectName: matiere.name,
          options: resolution.options,
          raison: resolution.raison,
        });
        continue;
      }

      impossibles.push({
        subjectId: matiere.id,
        subjectName: matiere.name,
        raison: resolution.raison,
      });
    }

    const totalLeconsACreer = aCreer.reduce((sum, item) => sum + item.nbLecons, 0);

    return {
      classe: {
        id: classe.id,
        name: classe.name,
        level: classe.level,
        levelNormalise,
        filiere: classe.filiere,
        serie: classe.serie,
        pebsMixte: classe.pebsMixte,
        academicYearId: classe.academicYearId,
      },
      resume: {
        totalMatieres: classe.subjects.length,
        aCreer: aCreer.length,
        ignores: ignores.length,
        choixRequis: choixRequis.length,
        impossibles: impossibles.length,
        totalLeconsACreer,
      },
      aCreer,
      ignores,
      choixRequis,
      impossibles,
      progressionsParSubjectId,
    };
  }
}
