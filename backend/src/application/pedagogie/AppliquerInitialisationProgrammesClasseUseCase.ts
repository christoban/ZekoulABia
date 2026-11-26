/**
 * APPLICATION LAYER — Use Case d'application atomique (apply) de la matérialisation
 * des programmes nationaux pour une classe.
 *
 * Garanties :
 * - Transaction unique atomique pour tous les programmes et leçons créés.
 * - Idempotent : relancer n'engendre aucun doublon et ne touche jamais aux coches
 *   (ChapitreAvancement) ni aux modules désactivés (ProgrammeModuleEtat).
 * - Ne modifie et n'écrase jamais un Programme manuel existant.
 */
import type {
  MaterialisationProgrammeRepository,
  ProgrammeMaterialiseResultat,
  ProgrammeNationalACreer,
} from '@domain/ports/repositories/MaterialisationProgrammeRepository';
import type {
  ProposerInitialisationClasseInput,
  ProposerInitialisationProgrammesClasseUseCase,
  PropositionChoixRequisItem,
  PropositionIgnoreItem,
  PropositionImpossibleItem,
} from './ProposerInitialisationProgrammesClasseUseCase';

export interface AppliquerInitialisationClasseResultat {
  classe: {
    id: string;
    name: string;
    level: string | null;
    academicYearId: string;
  };
  totalCrees: number;
  totalLeconsCreees: number;
  crees: ProgrammeMaterialiseResultat[];
  ignores: PropositionIgnoreItem[];
  choixRequis: PropositionChoixRequisItem[];
  impossibles: PropositionImpossibleItem[];
}

export class AppliquerInitialisationProgrammesClasseUseCase {
  constructor(
    private readonly proposerUseCase: ProposerInitialisationProgrammesClasseUseCase,
    private readonly materialisationRepo: MaterialisationProgrammeRepository,
  ) {}

  async execute(
    input: ProposerInitialisationClasseInput,
  ): Promise<AppliquerInitialisationClasseResultat> {
    const proposition = await this.proposerUseCase.evaluerAvecDetails(input);

    if (proposition.aCreer.length === 0) {
      return {
        classe: {
          id: proposition.classe.id,
          name: proposition.classe.name,
          level: proposition.classe.level,
          academicYearId: proposition.classe.academicYearId,
        },
        totalCrees: 0,
        totalLeconsCreees: 0,
        crees: [],
        ignores: proposition.ignores,
        choixRequis: proposition.choixRequis,
        impossibles: proposition.impossibles,
      };
    }

    const itemsACreer: ProgrammeNationalACreer[] = [];
    for (const item of proposition.aCreer) {
      const progression = proposition.progressionsParSubjectId.get(item.subjectId);
      if (!progression) continue;

      itemsACreer.push({
        schoolId: input.schoolId,
        subjectId: item.subjectId,
        classId: proposition.classe.id,
        level: proposition.classe.level,
        academicYearId: proposition.classe.academicYearId,
        titre: progression.titre,
        officialProgressionId: progression.id,
        sourceChecksum: progression.importChecksum,
        filiere: item.filiere || null,
        chapitres: progression.chapitres,
      });
    }

    const crees = await this.materialisationRepo.creerProgrammesEtChapitresAtomique(itemsACreer);
    const totalLeconsCreees = crees.reduce((sum, c) => sum + c.nbLeconsCreees, 0);

    return {
      classe: {
        id: proposition.classe.id,
        name: proposition.classe.name,
        level: proposition.classe.level,
        academicYearId: proposition.classe.academicYearId,
      },
      totalCrees: crees.length,
      totalLeconsCreees,
      crees,
      ignores: proposition.ignores,
      choixRequis: proposition.choixRequis,
      impossibles: proposition.impossibles,
    };
  }
}
