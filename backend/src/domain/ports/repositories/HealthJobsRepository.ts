/**
 * Port — Health Jobs (Inngest) : abstraction des requêtes Prisma utilisées
 * par health.ts (alertes santé, digest, scoring).
 */
export interface StudentContext {
  nomComplet: string;
  classId: string | null;
  className: string | null;
  professorPrincipalId: string | null;
}

export interface SchoolConfigHealth {
  aiAlertsEnabled: boolean | null;
  aiRiskThreshold: number | null;
  aiRiskThresholdCritical: number | null;
}

export interface RecommendationCreateData {
  schoolId: string;
  studentId: string;
  subjectId?: string | null;
  recipientRole: "STUDENT" | "PARENT" | "TEACHER";
  contextType: "HEALTH_CRITICAL" | "HEALTH_WARNING" | "HEALTH_POSITIVE" | "SUBJECT_DROP";
  content: string;
}

export interface DigestStudentHealth {
  healthScore: number | null;
  user: { firstName: string; lastName: string };
  enrollmentsYearScoped: { class: { name: string; professorPrincipalId: string | null } }[];
}

export interface HealthJobsRepository {
  // Écoles / config
  findActiveSchools(): Promise<{ id: string }[]>;
  getSchoolConfig(schoolId: string): Promise<SchoolConfigHealth | null>;
  findCurrentAcademicYear(schoolId: string): Promise<{ id: string } | null>;
  findStudentIdsForSchool(schoolId: string): Promise<{ userId: string }[]>;

  // Contexte élève
  findStudentContext(studentId: string, schoolId: string): Promise<StudentContext>;

  // Recommandations
  createRecommendation(data: RecommendationCreateData): Promise<void>;
  countCriticalRecommendations(studentId: string, schoolId: string, since: Date): Promise<number>;

  // Orientation
  findFicheOrientation(studentId: string, academicYearId: string): Promise<{ id: string } | null>;
  findStaffByPermission(schoolId: string, permission: string): Promise<{ userId: string }[]>;

  // Digest
  findStudentsWithHealthScoreLte(schoolId: string, threshold: number): Promise<DigestStudentHealth[]>;
  findTeacherRecommendationsSince(schoolId: string, since: Date): Promise<{ studentId: string; subjectId: string | null }[]>;
  findStudentProfilesForDigest(schoolId: string, studentIds: string[]): Promise<Array<{
    userId: string;
    user: { firstName: string; lastName: string };
    enrollmentsYearScoped: { class: { name: string; professorPrincipalId: string | null } }[];
  }>>;
  findSubjectsByIds(subjectIds: string[]): Promise<{ id: string; name: string }[]>;
}
