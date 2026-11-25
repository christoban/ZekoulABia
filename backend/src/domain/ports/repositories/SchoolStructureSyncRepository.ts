/**
 * DOMAIN LAYER — Port Repository SchoolStructureSync
 * Encapsule la persistance pour la synchronisation des matières/coefficients
 * et la mise à jour non-destructive de la structure des classes.
 */

export interface SchoolTemplateAndConfig {
  onboardingConfig: unknown;
  templateCode: string | null;
}

export interface SchoolSyncClassRecord {
  id: string;
  name: string;
  level: string | null;
  serie: string | null;
  filiere: string | null;
}

export interface SchoolSubjectSummary {
  id: string;
  name: string;
}

export interface SchoolStructureSyncRepository {
  findSchoolTemplateAndConfig(schoolId: string): Promise<SchoolTemplateAndConfig | null>;
  findCurrentAcademicYearId(schoolId: string): Promise<string | null>;
  updateOnboardingConfig(schoolId: string, onboardingConfig: Record<string, unknown>): Promise<void>;
  findClassesForSync(schoolId: string): Promise<SchoolSyncClassRecord[]>;
  findExistingClassNames(schoolId: string): Promise<string[]>;
  createClass(input: {
    schoolId: string;
    academicYearId: string;
    name: string;
    level: string;
  }): Promise<void>;
  updateClassSerie(classId: string, serie: string | null): Promise<void>;
  findSubjectsSummary(schoolId: string): Promise<SchoolSubjectSummary[]>;
  countSubjectCoefficients(
    schoolId: string,
    filter?: { classLevel?: string; serieCode?: string | null },
  ): Promise<number>;
  countDepartments(schoolId: string): Promise<number>;
  createDepartment(schoolId: string, name: string, color: string): Promise<{ id: string; name: string }>;
  assignSubjectDepartment(subjectId: string, departmentId: string): Promise<void>;
}
