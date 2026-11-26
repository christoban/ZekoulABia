/**
 * APPLICATION LAYER — Use Case Lot 2 : Initialisation en lot (propose / apply)
 * des programmes nationaux pour toutes les classes actives d'un établissement
 * (ex. nouvelle année scolaire ou démarrage pilote complet).
 *
 * Garanties :
 * - Dry-run strict sur proposer() (zéro écriture).
 * - Idempotent sur appliquer() : aucun doublon, aucun écrasement de programme manuel,
 *   aucun impact sur ChapitreAvancement ni ProgrammeModuleEtat.
 */
import type { SynchronisationProgrammeRepository } from '@domain/ports/repositories/SynchronisationProgrammeRepository';
import type { OptionClassique } from '@domain/rules/officialProgressionResolution';
import type {
  ProposerInitialisationProgrammesClasseUseCase,
  PropositionInitialisationClasseResultat,
} from './ProposerInitialisationProgrammesClasseUseCase';
import type {
  AppliquerInitialisationClasseResultat,
  AppliquerInitialisationProgrammesClasseUseCase,
} from './AppliquerInitialisationProgrammesClasseUseCase';

export interface InitialiserProgrammesEcoleInput {
  schoolId: string;
  academicYearId?: string;
  optionsClassiquesParClasse?: Record<string, Record<string, OptionClassique>>;
}

export interface PropositionInitialisationEcoleResultat {
  resume: {
    totalClasses: number;
    classesAvecCreations: number;
    totalProgrammesACreer: number;
    totalLeconsACreer: number;
    totalIgnores: number;
    totalChoixRequis: number;
    totalImpossibles: number;
  };
  classes: PropositionInitialisationClasseResultat[];
}

export interface AppliquerInitialisationEcoleResultat {
  resume: {
    totalClassesTraitees: number;
    totalProgrammesCrees: number;
    totalLeconsCreees: number;
    totalIgnores: number;
    totalChoixRequis: number;
    totalImpossibles: number;
  };
  classes: AppliquerInitialisationClasseResultat[];
}

export class InitialiserProgrammesEcoleUseCase {
  constructor(
    private readonly syncRepo: SynchronisationProgrammeRepository,
    private readonly proposerClasse: ProposerInitialisationProgrammesClasseUseCase,
    private readonly appliquerClasse: AppliquerInitialisationProgrammesClasseUseCase,
  ) {}

  async proposer(
    input: InitialiserProgrammesEcoleInput,
  ): Promise<PropositionInitialisationEcoleResultat> {
    const classesActives = await this.syncRepo.listerClassesActivesEcole(
      input.schoolId,
      input.academicYearId,
    );

    const details: PropositionInitialisationClasseResultat[] = [];
    for (const cls of classesActives) {
      const prop = await this.proposerClasse.execute({
        schoolId: input.schoolId,
        classId: cls.id,
        academicYearId: input.academicYearId ?? cls.academicYearId,
        optionsClassiques: input.optionsClassiquesParClasse?.[cls.id],
      });
      details.push(prop);
    }

    return {
      resume: {
        totalClasses: details.length,
        classesAvecCreations: details.filter((d) => d.resume.aCreer > 0).length,
        totalProgrammesACreer: details.reduce((s, d) => s + d.resume.aCreer, 0),
        totalLeconsACreer: details.reduce((s, d) => s + d.resume.totalLeconsACreer, 0),
        totalIgnores: details.reduce((s, d) => s + d.resume.ignores, 0),
        totalChoixRequis: details.reduce((s, d) => s + d.resume.choixRequis, 0),
        totalImpossibles: details.reduce((s, d) => s + d.resume.impossibles, 0),
      },
      classes: details,
    };
  }

  async appliquer(
    input: InitialiserProgrammesEcoleInput,
  ): Promise<AppliquerInitialisationEcoleResultat> {
    const classesActives = await this.syncRepo.listerClassesActivesEcole(
      input.schoolId,
      input.academicYearId,
    );

    const resultats: AppliquerInitialisationClasseResultat[] = [];
    for (const cls of classesActives) {
      const res = await this.appliquerClasse.execute({
        schoolId: input.schoolId,
        classId: cls.id,
        academicYearId: input.academicYearId ?? cls.academicYearId,
        optionsClassiques: input.optionsClassiquesParClasse?.[cls.id],
      });
      resultats.push(res);
    }

    return {
      resume: {
        totalClassesTraitees: resultats.length,
        totalProgrammesCrees: resultats.reduce((s, r) => s + r.totalCrees, 0),
        totalLeconsCreees: resultats.reduce((s, r) => s + r.totalLeconsCreees, 0),
        totalIgnores: resultats.reduce((s, r) => s + r.ignores.length, 0),
        totalChoixRequis: resultats.reduce((s, r) => s + r.choixRequis.length, 0),
        totalImpossibles: resultats.reduce((s, r) => s + r.impossibles.length, 0),
      },
      classes: resultats,
    };
  }
}
