/**
 * DOMAIN LAYER — Port de lecture dédié au profil académique élève (V1.1)
 *
 * Agrège les bulletins et lignes matière d'un élève pour une année académique.
 * Lecture seule — aucune écriture. Pattern inspiré de ClassCouncilPreviewQueryPort.
 */

export interface LigneMatiereProfil {
  subjectId: string;
  subjectName: string;
  coefficient: number;
  subjectAverage: number | null;
}

export interface BulletinProfil {
  academicPeriodId: string;
  academicPeriodName: string;
  generalAverage: number | null;
  lignes: LigneMatiereProfil[];
}

export interface AcademicProfileData {
  studentFirstName: string;
  studentLastName: string;
  bulletins: BulletinProfil[];
}

export interface AcademicProfileQueryPort {
  obtenirProfilAcademique(
    studentId: string,
    schoolId: string,
    academicYearId: string,
  ): Promise<AcademicProfileData | null>;
}
