export type ClassePourGeneration = {
  id: string;
  name: string;
  level: string | null;
  serie: string | null;
  filiere: string | null;
  academicYearId: string;
};

export type MatiereCandidateGeneration = {
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  weeklyPeriods: number | null;
};

export type EnseignantQualifieGeneration = {
  teacherId: string;
  subjectId: string;
  estAP: boolean;
};

export type AffectationExistanteGeneration = {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  subjectHoursPerWeek?: number;
};

export type DonneesGenerationAffectations = {
  classes: ClassePourGeneration[];
  matieres: MatiereCandidateGeneration[];
  enseignants: EnseignantQualifieGeneration[];
  affectations: AffectationExistanteGeneration[];
};

export type AssignmentACreerPayload = {
  classId: string;
  subjectId: string;
  teacherId: string;
  schoolId: string;
  academicYearId: string;
};

export type AssignmentAModifierPayload = {
  id: string;
  teacherId: string;
};

export type IssueAffectationGeneration = {
  classId: string;
  subjectId: string;
  reason: string;
  details?: Record<string, unknown>;
};

export interface TeachingAssignmentGeneratorRepository {
  loadGenerationData(
    schoolId: string,
    academicYearId: string,
    classId?: string,
  ): Promise<DonneesGenerationAffectations>;

  createAssignmentsInTransaction(assignments: AssignmentACreerPayload[]): Promise<number>;

  updateAssignmentsInTransaction(assignments: AssignmentAModifierPayload[]): Promise<number>;

  persistIssues(params: {
    schoolId: string;
    academicYearId: string;
    issues: IssueAffectationGeneration[];
  }): Promise<number>;

  /**
   * Synchronise le StudentGroupSet "LV2" et les groupes/memberships à partir des choix
   * d'LV2 des élèves inscrits. Idempotent.
   */
  syncLv2Groups(schoolId: string, academicYearId: string): Promise<void>;
}
