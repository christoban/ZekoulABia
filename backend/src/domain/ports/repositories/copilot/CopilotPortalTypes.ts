/**
 * DOMAIN LAYER — Types et DTOs du port `CopilotPortalGateway` (portails Parent, Staff, Student, Teacher).
 */
import type { AttendancePeriod, AttendanceStatus, DisciplineType } from '@domain/types/enums';

export type PortalDisciplineStatus = 'ACTIVE' | 'LIFTED' | 'APPEALED';
export type PortalLoanStatus = 'ACTIVE' | 'RETURNED' | 'OVERDUE';
export type PortalRiskLevel = 'FAIBLE' | 'MOYEN' | 'ELEVE' | 'CRITIQUE';

export interface PortalPersonName {
  firstName: string | null;
  lastName: string | null;
}

export interface PortalParentChild {
  studentUserId: string;
  studentProfileId: string;
  firstName: string | null;
  lastName: string | null;
  className: string | null;
}

export interface PortalStudentRecentGrade {
  sequenceAverage: number;
  subjectName: string;
  sequenceName: string;
}

export interface PortalStudentSequenceGrade {
  sequenceAverage: number;
  coefficient: number;
  isAbsentGrade: boolean;
}

export interface PortalRecentStudentGradesParams {
  schoolId: string;
  studentId: string;
  subjectNameContains?: string;
  take: number;
}

export interface PortalAttendanceFilter {
  schoolId: string;
  since: Date;
  studentId?: string;
  classId?: string;
  teacherId?: string;
  statuses?: AttendanceStatus[];
}

export interface PortalUnpaidInvoice {
  id: string;
  amount: number;
  feePlanName: string | null;
  successfulPaymentsTotal: number;
}

export interface PortalActiveBookLoan {
  id: string;
  bookId: string;
  bookTitle: string;
  dueDate: Date | null;
  status: PortalLoanStatus;
}

export interface PortalActiveStudentBookLoansParams {
  schoolId: string;
  studentId: string;
  bookTitleContains?: string;
}

export interface PortalBookAvailability {
  id: string;
  title: string;
  available: number;
}

export interface PortalBookSearchResult {
  title: string;
  author: string | null;
  available: number;
  quantity: number;
}

export interface PortalCreateBookLoanParams {
  schoolId: string;
  bookId: string;
  studentId: string;
  dueDate: Date;
}

export interface PortalBookLoanMutationParams {
  schoolId: string;
  loanId: string;
  bookId: string;
}

export interface PortalTeacherAssignmentCheck {
  schoolId: string;
  teacherId: string;
  classId: string;
  subjectId?: string;
}

export interface PortalTeacherAssignment {
  className: string;
  subjectName: string;
}

export interface PortalTeacherGradeProgressParams {
  schoolId: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  sequenceId: string;
}

export interface PortalTeacherGradeProgress {
  totalStudents: number;
  draftCount: number;
  recordedCount: number;
}

export interface PortalClassSubjectSequenceGradesParams {
  schoolId: string;
  classId: string;
  subjectId: string;
  sequenceId: string;
}

export interface PortalClassSubjectSequenceGrade {
  sequenceAverage: number | null;
  isAbsentGrade: boolean;
}

export interface PortalLatestAttendanceParams {
  schoolId: string;
  studentId: string;
  classId: string;
  date: Date;
  period: AttendancePeriod;
}

export interface PortalCreateCahierDeTexteParams {
  schoolId: string;
  teacherId: string;
  classId: string;
  subjectId: string;
  academicYearId: string;
  date: Date;
  contenuLibre: string;
  devoirsDonnes?: string;
}

export interface PortalCreateDisciplineRecordParams {
  schoolId: string;
  studentId: string;
  type: DisciplineType;
  reason: string;
  decidedById: string;
  startDate?: Date;
  endDate?: Date;
}

export interface PortalActiveDisciplineRecord {
  id: string;
  type: DisciplineType;
}

export interface PortalDisciplineRecordSummary {
  type: DisciplineType;
  reason: string;
  status: PortalDisciplineStatus;
  createdAt: Date;
}

export interface PortalPendingApeeExpense {
  id: string;
  montant: number;
}

export interface PortalApeeBalanceSummary {
  totalCollectes: number;
  totalDepenses: number;
  pendingExpensesCount: number;
}

export interface PortalOrientationFicheLookup {
  schoolId: string;
  studentId: string;
  academicYearId: string;
}

export interface PortalOrientationRiskLookup {
  schoolId: string;
  academicYearId: string;
  classId?: string;
}

export interface PortalOrientationRiskFiche {
  riskLevel: PortalRiskLevel;
  firstName: string | null;
  lastName: string | null;
}
