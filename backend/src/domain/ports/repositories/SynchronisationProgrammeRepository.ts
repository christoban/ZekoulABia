/**
 * DOMAIN LAYER — Port Repository pour la détection de dérive (sourceChecksum)
 * et la synchronisation différentielle non destructive des programmes nationaux (Lot 2).
 */
import type { OfficialChapterSource } from '@domain/ports/repositories/MaterialisationProgrammeRepository';
import type {
  ChapitreEcolePourDiff,
  DiffChapitreAjoute,
  DiffChapitreModifie,
} from '@domain/rules/officialProgressionDiff';

export interface ProgrammeNationalPourSync {
  id: string;
  schoolId: string;
  subjectId: string;
  subjectName: string;
  classId: string | null;
  className: string | null;
  level: string | null;
  filiere: string | null;
  academicYearId: string;
  titre: string;
  source: string;
  sourceChecksum: string | null;
  officialProgressionId: string;
  officialTitre: string;
  officialChecksum: string | null;
  officialActive: boolean;
  chapitresEcole: ChapitreEcolePourDiff[];
  chapitresOfficiels: OfficialChapterSource[];
}

export interface AppliquerSyncAtomiqueInput {
  schoolId: string;
  programmeId: string;
  officialProgressionId: string;
  nouveauTitre: string;
  nouveauChecksum: string | null;
  ajoutes: DiffChapitreAjoute[];
  modifies: DiffChapitreModifie[];
}

export interface AppliquerSyncAtomiqueResultat {
  programmeId: string;
  nbAjoutes: number;
  nbModifies: number;
  nouveauChecksum: string | null;
}

export interface SynchronisationProgrammeRepository {
  listerClassesActivesEcole(
    schoolId: string,
    academicYearId?: string,
  ): Promise<Array<{ id: string; name: string; level: string | null; academicYearId: string }>>;

  listerProgrammesNationauxAvecReference(
    schoolId: string,
    academicYearId?: string,
  ): Promise<ProgrammeNationalPourSync[]>;

  findProgrammePourSynchronisation(
    schoolId: string,
    programmeId: string,
  ): Promise<ProgrammeNationalPourSync | null>;

  /**
   * Applique atomiquement les ajouts et mises à jour en place (même Chapitre.id),
   * sans jamais supprimer de Chapitre ni toucher à ChapitreAvancement / ProgrammeModuleEtat / CahierDeTexte.
   */
  appliquerSynchronisationAtomique(
    input: AppliquerSyncAtomiqueInput,
  ): Promise<AppliquerSyncAtomiqueResultat>;
}
