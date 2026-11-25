/**
 * DOMAIN — Port ClasseCoefficientRepository
 * Abstrait `classSubjectOverride` (override par classe) et `subjectCoefficient` (coefficient partagé par niveau/série).
 */

export interface ClassSubjectOverrideRecord {
  id: string;
  schoolId: string;
  classId: string;
  subjectId: string;
  coefficient: number;
  groupKey?: string | null;
  groupLabel?: string | null;
  groupOrder?: number | null;
}

export interface SubjectCoefficientRecord {
  id: string;
  schoolId: string;
  subjectId: string;
  classLevel: string;
  serieCode: string | null;
  coefficient: number;
  groupKey?: string | null;
  groupLabel?: string | null;
  groupOrder?: number | null;
}

export interface ClasseCoefficientRepository {
  findOverride(classId: string, subjectId: string): Promise<ClassSubjectOverrideRecord | null>;
  findCurriculumConfigsForClass(params: {
    schoolId: string;
    classId: string;
    classLevel?: string | null;
    serieCode?: string | null;
  }): Promise<{
    overrides: ClassSubjectOverrideRecord[];
    levelCoefficients: SubjectCoefficientRecord[];
  }>;
  upsertOverride(params: {
    schoolId: string;
    classId: string;
    subjectId: string;
    coefficient: number;
    groupKey?: string | null;
    groupLabel?: string | null;
    groupOrder?: number | null;
  }): Promise<ClassSubjectOverrideRecord>;
  deleteOverride(classId: string, subjectId: string): Promise<void>;
  upsertCoefficient(params: {
    schoolId: string;
    subjectId: string;
    classLevel: string;
    serieCode: string | null;
    coefficient: number;
    groupKey?: string | null;
    groupLabel?: string | null;
    groupOrder?: number | null;
  }): Promise<SubjectCoefficientRecord>;
  deleteCoefficientsForSubject(params: {
    schoolId: string;
    subjectId: string;
    classLevel: string;
    serieCode: string | null;
  }): Promise<number>;
}
