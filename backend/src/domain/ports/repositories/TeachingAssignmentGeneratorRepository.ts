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
  classId: string;
  subjectId: string;
  teacherId: string;
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

export interface TeachingAssignmentGeneratorRepository {
  loadGenerationData(
    schoolId: string,
    academicYearId: string,
    classId?: string,
  ): Promise<DonneesGenerationAffectations>;

  createAssignmentsInTransaction(assignments: AssignmentACreerPayload[]): Promise<number>;
}
