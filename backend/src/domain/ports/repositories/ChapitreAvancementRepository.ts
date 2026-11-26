/**
 * DOMAIN LAYER — Port Repository pour la coche directe des leçons (ChapitreAvancement)
 * et l'activation/désactivation des modules (ProgrammeModuleEtat).
 */

export interface ChapitreAvancementProps {
  id: string;
  schoolId: string;
  classId: string;
  chapitreId: string;
  academicYearId: string;
  statut: string;
  cocheParId: string;
  cocheLe: Date;
}

export interface ProgrammeModuleEtatProps {
  id: string;
  schoolId: string;
  programmeId: string;
  moduleOrdre: number;
  actif: boolean;
  modifieParId: string;
  modifieLe: Date;
}

export interface ChapitreContextePourCoche {
  chapitreId: string;
  programmeId: string;
  schoolId: string;
  subjectId: string;
  classId: string | null;
  level: string | null;
  academicYearId: string;
  moduleOrdre: number | null;
}

export interface ProgrammeContextePourModule {
  programmeId: string;
  schoolId: string;
  subjectId: string;
  classId: string | null;
  level: string | null;
  academicYearId: string;
  modulesOrdresExistants: number[];
}

export interface ChapitreAvancementRepository {
  findAvancementsByClass(
    schoolId: string,
    classId: string,
    academicYearId: string,
  ): Promise<ChapitreAvancementProps[]>;

  findAvancementsByClassAndChapitres(
    schoolId: string,
    classId: string,
    chapitreIds: string[],
  ): Promise<ChapitreAvancementProps[]>;

  marquerFait(data: {
    schoolId: string;
    classId: string;
    chapitreId: string;
    academicYearId: string;
    cocheParId: string;
  }): Promise<ChapitreAvancementProps>;

  retirerCocheDirecte(
    schoolId: string,
    classId: string,
    chapitreId: string,
  ): Promise<boolean>;

  findModuleEtatsByProgramme(
    schoolId: string,
    programmeId: string,
  ): Promise<ProgrammeModuleEtatProps[]>;

  findModuleEtatsByProgrammes(
    schoolId: string,
    programmeIds: string[],
  ): Promise<ProgrammeModuleEtatProps[]>;

  definirModuleActif(data: {
    schoolId: string;
    programmeId: string;
    moduleOrdre: number;
    actif: boolean;
    modifieParId: string;
  }): Promise<ProgrammeModuleEtatProps>;

  findChapitreContextePourCoche(
    schoolId: string,
    chapitreId: string,
  ): Promise<ChapitreContextePourCoche | null>;

  findProgrammeContextePourModule(
    schoolId: string,
    programmeId: string,
  ): Promise<ProgrammeContextePourModule | null>;

  /** Vérifie si l'utilisateur est chef (Animateur Pédagogique) du département contenant subjectId. */
  estAnimateurPedagogiqueDeMatiere(
    schoolId: string,
    userId: string,
    subjectId: string,
  ): Promise<boolean>;
}
