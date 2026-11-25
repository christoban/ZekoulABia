/**
 * DOMAIN LAYER — Port de lecture dédié au contexte IA (AIController).
 *
 * Agrégateur de contexte de l'assistant IA : toutes les lectures Prisma du
 * controller (insight, suivi santé, risque, bulletin, chat, détection,
 * comparaison de prédictions) passent ici. Lecture seule — jamais d'écriture.
 * Existe séparément des repositories CRUD pour ne pas injecter PrismaClient
 * dans le controller (cohérence hexagonale).
 */

import type { StaffPermissionType } from '@domain/types/enums';

export interface StudentWithClass {
  userId: string;
  firstName: string;
  lastName: string | null;
  classId: string | null;
  className: string | null;
  healthScore: number | null;
}

export interface StudentRecommendationDto {
  id: string;
  studentId: string;
  recipientRole: string;
  contextType: string | null;
  subjectId: string | null;
  content: string | null;
  createdAt: Date;
}

export interface StudentGradeDto {
  sequenceAverage: number | null;
  subjectName: string;
}

export interface StudentSummary {
  firstName: string;
  lastName: string | null;
  className: string | null;
}

export interface SchoolDto {
  name: string | null;
  subsystem: string | null;
  educationType: string | null;
  templateCode: string | null;
}

export interface TeacherAssignmentDto {
  classId: string;
  subjectId: string;
  subjectName: string;
}

export interface AIContextQueryRepository {
  // ── Langue / école ──────────────────────────────────────────────────────
  getLanguageSousSysteme(schoolId: string): Promise<string | null>;
  findSchoolById(schoolId: string): Promise<SchoolDto | null>;

  // ── Garde-fous RBAC/tenant (estAutoriseAVoirRisqueEleve / peupleVueEnsemble) ──
  findStudentProfile(userId: string, schoolId: string): Promise<StudentSummary | null>;
  hasTeachingAssignment(teacherId: string, classId: string): Promise<boolean>;
  isProfesseurPrincipal(classId: string, teacherId: string): Promise<boolean>;
  hasParentStudentLink(parentUserId: string, studentId: string): Promise<boolean>;
  countStaffWithPermission(schoolId: string, permissions: StaffPermissionType[]): Promise<number>;

  // ── Insight generateInsight ─────────────────────────────────────────────
  countStudentProfiles(schoolId: string): Promise<number>;
  getRecentValidatedGrades(schoolId: string): Promise<{ sequenceAverage: number | null }[]>;
  getAttendanceStatusCountsSince(schoolId: string, since: Date): Promise<{ status: string; _count: number }[]>;
  findTeacherProfileWithSubjects(userId: string): Promise<{ teacherSubjects: { subject: { name: string } }[] } | null>;
  findRecentGradesByStudent(schoolId: string, studentId: string): Promise<{ sequenceAverage: number | null; subject: { name: string } }[]>;

  // ── Vue santé (getStudentsHealth / getAtRiskStudentsForTeacher / getHealthTracking) ──
  findStudentsByClass(schoolId: string, classId?: string): Promise<StudentWithClass[]>;
  findStudentsByClasses(classIds: string[], options?: { healthScoreLte?: number }): Promise<StudentWithClass[]>;
  findStudentHealthScores(studentIds: string[]): Promise<{ userId: string; healthScore: number | null }[]>;
  findParentChildren(parentUserId: string): Promise<{ studentId: string; firstName: string; lastName: string | null; className: string | null }[]>;
  getSchoolConfig(schoolId: string): Promise<{ aiRiskThreshold: number | null; aiRiskThresholdCritical: number | null } | null>;
  findStudentRecommendations(input: {
    schoolId?: string;
    studentIds: string[];
    recipientRole: string;
    contextTypes?: string[];
    since?: Date;
  }): Promise<StudentRecommendationDto[]>;

  // ── Enseignant (getAtRiskStudentsForTeacher) ─────────────────────────────
  findTeachingAssignmentsByTeacher(teacherId: string, schoolId: string): Promise<TeacherAssignmentDto[]>;
  findClassesByProfesseurPrincipal(teacherId: string, schoolId: string): Promise<{ id: string }[]>;

  // ── Détection (detectRisk) ──────────────────────────────────────────────
  findGradesByStudent(schoolId: string, studentId: string): Promise<StudentGradeDto[]>;
  findAttendanceStatuses(schoolId: string, studentId: string, since: Date): Promise<{ status: string }[]>;

  // ── Assistant contextualisé (assistantChat) ─────────────────────────────
  findClassesBySchool(schoolId: string): Promise<{ name: string }[]>;
  findSubjectsBySchool(schoolId: string): Promise<{ name: string; coefficient: number }[]>;
  findDepartmentsBySchool(schoolId: string): Promise<{ name: string }[]>;
  findCurrentPeriods(schoolId: string): Promise<{ name: string }[]>;

  // ── Comparaison de prédictions (comparerRisquePredictions) ──────────────
  findCurrentAcademicYear(schoolId: string): Promise<{ id: string } | null>;
}
