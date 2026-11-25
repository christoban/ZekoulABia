/**
 * DOMAIN LAYER — Port passerelle partagé pour la résolution d'entités et lectures
 * communes du copilot (classes, enseignants, matières, élèves, périodes, notes).
 */

export interface CopilotNamedEntity {
  id: string;
  name: string;
}

export interface CopilotPersonEntity {
  id: string;
  firstName: string | null;
  lastName: string | null;
}

export interface CopilotStudentCandidate {
  id: string;
  firstName: string | null;
  lastName: string | null;
  className: string | null;
}

export interface CopilotFeePlanCandidate {
  id: string;
  name: string;
  amount: number;
}

export interface CopilotSequenceGradeRow {
  studentId: string;
  sequenceAverage: number | null;
  coefficient: number;
  isAbsentGrade: boolean;
}

export interface CopilotSharedGateway {
  findClassesBySchool(schoolId: string): Promise<CopilotNamedEntity[]>;
  findTeachersBySchool(schoolId: string): Promise<CopilotPersonEntity[]>;
  findSubjectsBySchool(schoolId: string): Promise<CopilotNamedEntity[]>;
  findStudentsBySchool(schoolId: string): Promise<CopilotStudentCandidate[]>;
  findEmployeesBySchool(schoolId: string): Promise<CopilotPersonEntity[]>;
  findFeePlansBySchool(schoolId: string): Promise<CopilotFeePlanCandidate[]>;
  findEntranceExamSessionsBySchool(schoolId: string): Promise<CopilotNamedEntity[]>;
  findPebsExamSessionsBySchool(schoolId: string): Promise<CopilotNamedEntity[]>;
  findCurrentAcademicYear(schoolId: string): Promise<CopilotNamedEntity | null>;
  findCurrentAcademicPeriod(schoolId: string): Promise<CopilotNamedEntity | null>;
  findCurrentAcademicSequence(schoolId: string): Promise<CopilotNamedEntity | null>;
  findSchoolSubsystem(schoolId: string): Promise<{ subsystem: string } | null>;
  findClassLevel(schoolId: string, classId: string): Promise<{ level: string | null } | null>;
  findClassSequenceGrades(
    schoolId: string,
    classId: string,
    sequenceId: string,
  ): Promise<CopilotSequenceGradeRow[]>;
}
