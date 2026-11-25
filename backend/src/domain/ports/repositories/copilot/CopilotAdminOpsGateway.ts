/**
 * DOMAIN LAYER — Port passerelle opérations Admin pour le copilot.
 */
import type { AttendanceStatus, PebsFiliere } from '@domain/types/enums';
import type { CopilotNamedEntity } from './CopilotSharedGateway';
import type {
  CopilotAbsenceStudentRow,
  CopilotAtRiskStudentRow,
  CopilotCepPendingCandidate,
  CopilotClassDeletionImpact,
  CopilotClassPrincipalName,
  CopilotClassRoomAssignmentRef,
  CopilotRoomRestoreData,
  CopilotRoomSnapshot,
  CopilotSchoolRiskThresholds,
  CopilotStudentLv2Row,
  CopilotStudentNameRow,
  CopilotStudentPebsRow,
  CopilotStudentRecommendationRow,
  CopilotSubjectSnapshot,
  CopilotTeacherDiplomaRow,
  CopilotUnjustifiedAbsenceRecord,
  CopilotUnpaidInvoiceBalance,
  CopilotUnpaidStudentInvoice,
  CopilotUserIdentitySnapshot,
} from './CopilotAdminOpsTypes';

export type {
  CopilotAbsenceStudentRow,
  CopilotAtRiskStudentRow,
  CopilotCepPendingCandidate,
  CopilotClassDeletionImpact,
  CopilotClassPrincipalName,
  CopilotClassRoomAssignmentRef,
  CopilotRoomRestoreData,
  CopilotRoomSnapshot,
  CopilotSchoolRiskThresholds,
  CopilotStudentLv2Row,
  CopilotStudentNameRow,
  CopilotStudentPebsRow,
  CopilotStudentRecommendationRow,
  CopilotSubjectSnapshot,
  CopilotTeacherDiplomaRow,
  CopilotUnjustifiedAbsenceRecord,
  CopilotUnpaidInvoiceBalance,
  CopilotUnpaidStudentInvoice,
  CopilotUserIdentitySnapshot,
};

export interface CopilotAdminOpsGateway {
  findCurrentAcademicYearId(schoolId: string): Promise<{ id: string } | null>;
  findClassPrincipalId(schoolId: string, classId: string): Promise<{ professorPrincipalId: string | null } | null>;
  clearClassPrincipal(schoolId: string, classId: string): Promise<void>;
  findClassPrincipal(schoolId: string, classId: string): Promise<CopilotClassPrincipalName | null>;
  countClassDeletionImpact(schoolId: string, classId: string): Promise<CopilotClassDeletionImpact>;
  countSubjectGrades(schoolId: string, subjectId: string): Promise<number>;
  findSubjectEditableFields(schoolId: string, subjectId: string): Promise<CopilotSubjectSnapshot | null>;
  softDeleteRooms(schoolId: string, roomIds: string[], deletedById: string): Promise<number>;
  findRoomByName(schoolId: string, name: string): Promise<CopilotRoomSnapshot | null>;
  restoreRoomSnapshot(schoolId: string, roomId: string, snapshot: CopilotRoomRestoreData): Promise<number>;
  findActiveClassesByAcademicYear(schoolId: string, academicYearId: string): Promise<CopilotNamedEntity[]>;
  findActiveRoomsBySchool(schoolId: string): Promise<CopilotNamedEntity[]>;
  findActiveRoomByName(schoolId: string, name: string): Promise<CopilotNamedEntity | null>;
  findClassRoomAssignments(
    schoolId: string,
    academicYearId: string,
    classIds: string[],
  ): Promise<CopilotClassRoomAssignmentRef[]>;

  findCepPendingCandidates(schoolId: string): Promise<CopilotCepPendingCandidate[]>;
  findUserBasicIdentity(schoolId: string, userId: string): Promise<CopilotUserIdentitySnapshot | null>;
  findStudentProfileIdByUserId(schoolId: string, userId: string): Promise<{ id: string } | null>;
  findActiveStudentUserIdsByClass(schoolId: string, classId: string): Promise<string[]>;
  deleteEntranceExamSession(schoolId: string, sessionId: string): Promise<void>;
  deletePebsExamSession(schoolId: string, sessionId: string): Promise<void>;
  closeLv2ChoiceWindow(schoolId: string, windowId: string): Promise<void>;
  findStudentLv2SubjectId(schoolId: string, studentUserId: string): Promise<{ lv2SubjectId: string | null } | null>;
  findClassStudentsLv2(schoolId: string, classId: string): Promise<CopilotStudentLv2Row[]>;
  findStudentPebsFiliere(schoolId: string, studentUserId: string): Promise<{ pebsFiliere: PebsFiliere | null } | null>;
  findClassStudentsPebs(schoolId: string, classId: string): Promise<CopilotStudentPebsRow[]>;
  findClassStudentLv2Names(schoolId: string, classId: string): Promise<{ lv2SubjectName: string | null }[]>;
  findClassStudentsWithoutLv2(schoolId: string, classId: string): Promise<CopilotStudentNameRow[]>;

  deleteFeePlan(schoolId: string, planId: string): Promise<void>;
  findUnpaidInvoicesForStudent(schoolId: string, studentId: string): Promise<CopilotUnpaidStudentInvoice[]>;
  findUnpaidInvoicesWithPayments(schoolId: string, studentIds?: string[]): Promise<CopilotUnpaidInvoiceBalance[]>;
  findLatestUnjustifiedAbsence(
    schoolId: string,
    studentId: string,
    date?: Date,
  ): Promise<CopilotUnjustifiedAbsenceRecord | null>;
  updateAttendanceStatus(schoolId: string, attendanceId: string, status: AttendanceStatus): Promise<void>;
  findUnjustifiedAbsencesSince(
    schoolId: string,
    since: Date,
    studentIds?: string[],
  ): Promise<CopilotAbsenceStudentRow[]>;

  findLatestPendingLeaveRequest(schoolId: string, userId: string): Promise<{ id: string } | null>;
  findTeachersWithDiplomas(schoolId: string): Promise<CopilotTeacherDiplomaRow[]>;
  findSchoolRiskThresholds(schoolId: string): Promise<CopilotSchoolRiskThresholds | null>;
  findAtRiskStudents(
    schoolId: string,
    maxHealthScore: number,
    classId?: string,
  ): Promise<CopilotAtRiskStudentRow[]>;
  findStudentHealthScore(schoolId: string, studentUserId: string): Promise<{ healthScore: number | null } | null>;
  findLatestStudentRecommendation(
    schoolId: string,
    studentUserId: string,
    recipientRole: string,
  ): Promise<CopilotStudentRecommendationRow | null>;
}
