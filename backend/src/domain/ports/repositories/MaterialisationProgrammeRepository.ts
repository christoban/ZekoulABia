/**
 * DOMAIN LAYER — Port Repository pour la matérialisation des programmes officiels
 * nationaux (OfficialProgrammeProgression) vers une classe d'établissement.
 */
import type { OfficialProgressionCandidate } from '@domain/rules/officialProgressionResolution';

export interface ClasseMatierePourInit {
  id: string;
  name: string;
}

export interface ClassePourMaterialisation {
  id: string;
  schoolId: string;
  name: string;
  level: string | null;
  filiere: string | null;
  serie: string | null;
  pebsMixte: boolean;
  academicYearId: string;
  schoolTemplateCode: string;
  subjects: ClasseMatierePourInit[];
}

export interface OfficialChapterSource {
  ordre: number;
  titre: string;
  volumeHeuresPrevu: number | null;
  sequenceCibleFin: number | null;
  moduleOrdre: number | null;
  moduleTitre: string | null;
  positionDansModule: number | null;
  numeroAffiche: string | null;
  sourceUrl: string | null;
  sourceKey: string | null;
}

export interface OfficialProgressionAvecChapitres extends OfficialProgressionCandidate {
  chapitres: OfficialChapterSource[];
}

export interface ProgrammeExistantClasse {
  id: string;
  subjectId: string;
  titre: string;
  source: string;
  officialProgressionId: string | null;
  nbChapitres: number;
}

export interface ProgrammeNationalACreer {
  schoolId: string;
  subjectId: string;
  classId: string;
  level: string | null;
  academicYearId: string;
  titre: string;
  officialProgressionId: string;
  sourceChecksum: string | null;
  filiere: string | null;
  chapitres: OfficialChapterSource[];
}

export interface ProgrammeMaterialiseResultat {
  programmeId: string;
  subjectId: string;
  titre: string;
  officialProgressionId: string;
  nbLeconsCreees: number;
}

export interface MaterialisationProgrammeRepository {
  findClassePourMaterialisation(
    schoolId: string,
    classId: string,
    academicYearId?: string,
  ): Promise<ClassePourMaterialisation | null>;

  findOfficialProgressionsCandidates(params: {
    templateCodes: string[];
    levels: string[];
    filieres: string[];
  }): Promise<OfficialProgressionAvecChapitres[]>;

  findProgrammesExistantsClasse(
    schoolId: string,
    classId: string,
    academicYearId: string,
  ): Promise<ProgrammeExistantClasse[]>;

  /**
   * Crée atomiquement (transaction unique) l'ensemble des Programme + Chapitre
   * retenus pour une classe. Ne modifie ni n'écrase aucun Programme existant.
   */
  creerProgrammesEtChapitresAtomique(
    items: ProgrammeNationalACreer[],
  ): Promise<ProgrammeMaterialiseResultat[]>;
}
