/**
 * DOMAIN LAYER — Port passerelle portails (Parent, Staff, Student, Teacher) pour le copilot.
 */
import type { AttendanceStatus } from '@domain/types/enums';
import type {
  PortalActiveBookLoan,
  PortalActiveDisciplineRecord,
  PortalActiveStudentBookLoansParams,
  PortalApeeBalanceSummary,
  PortalAttendanceFilter,
  PortalBookAvailability,
  PortalBookLoanMutationParams,
  PortalBookSearchResult,
  PortalClassSubjectSequenceGrade,
  PortalClassSubjectSequenceGradesParams,
  PortalCreateBookLoanParams,
  PortalCreateCahierDeTexteParams,
  PortalCreateDisciplineRecordParams,
  PortalDisciplineRecordSummary,
  PortalLatestAttendanceParams,
  PortalOrientationFicheLookup,
  PortalOrientationRiskFiche,
  PortalOrientationRiskLookup,
  PortalParentChild,
  PortalPendingApeeExpense,
  PortalPersonName,
  PortalRecentStudentGradesParams,
  PortalStudentRecentGrade,
  PortalStudentSequenceGrade,
  PortalTeacherAssignment,
  PortalTeacherAssignmentCheck,
  PortalTeacherGradeProgress,
  PortalTeacherGradeProgressParams,
  PortalUnpaidInvoice,
} from './CopilotPortalTypes';

export type * from './CopilotPortalTypes';

export interface CopilotPortalGateway {
  // Parent & Student (partagés + spécifiques)
  findParentChildren(schoolId: string, parentUserId: string): Promise<PortalParentChild[] | null>;
  findStudentUnpaidInvoices(schoolId: string, studentId: string): Promise<PortalUnpaidInvoice[]>;
  findRecentStudentGrades(params: PortalRecentStudentGradesParams): Promise<PortalStudentRecentGrade[]>;
  findStudentSequenceGrades(
    schoolId: string,
    studentId: string,
    sequenceId: string,
  ): Promise<PortalStudentSequenceGrade[]>;

  // Présences (Parent, Student, Teacher)
  countAttendancesSince(filter: PortalAttendanceFilter): Promise<number>;
  findAttendanceStatusesSince(
    filter: Omit<PortalAttendanceFilter, 'statuses'>,
  ): Promise<Array<{ status: AttendanceStatus }>>;

  // Teacher
  hasTeacherAssignment(params: PortalTeacherAssignmentCheck): Promise<boolean>;
  findTeacherAssignments(schoolId: string, teacherId: string): Promise<PortalTeacherAssignment[]>;
  findStudentsInClass(schoolId: string, classId: string): Promise<PortalPersonName[]>;
  getTeacherGradeEntryProgress(params: PortalTeacherGradeProgressParams): Promise<PortalTeacherGradeProgress>;
  findClassSubjectSequenceGrades(
    params: PortalClassSubjectSequenceGradesParams,
  ): Promise<PortalClassSubjectSequenceGrade[]>;
  deleteGradeById(schoolId: string, gradeId: string): Promise<void>;
  findLatestAttendanceId(params: PortalLatestAttendanceParams): Promise<string | null>;
  deleteAttendanceById(schoolId: string, attendanceId: string): Promise<void>;
  createCahierDeTexteEntry(params: PortalCreateCahierDeTexteParams): Promise<{ id: string }>;
  deleteCahierDeTexteEntry(schoolId: string, entryId: string): Promise<void>;

  // Staff — Discipline
  createDisciplineRecord(params: PortalCreateDisciplineRecordParams): Promise<{ id: string }>;
  findLatestActiveDisciplineRecord(
    schoolId: string,
    studentId: string,
  ): Promise<PortalActiveDisciplineRecord | null>;
  liftDisciplineRecordById(schoolId: string, recordId: string): Promise<void>;
  findRecentDisciplineRecords(
    schoolId: string,
    studentId: string,
    take: number,
  ): Promise<PortalDisciplineRecordSummary[]>;

  // Staff — APEE
  deleteApeeTransactionById(schoolId: string, transactionId: string): Promise<void>;
  findPendingApeeExpenseByDescription(
    schoolId: string,
    descriptionContains: string,
  ): Promise<PortalPendingApeeExpense | null>;
  getApeeBalanceSummary(schoolId: string): Promise<PortalApeeBalanceSummary>;

  // Bibliothèque (Staff & Student)
  findBookByTitleContains(schoolId: string, titleContains: string): Promise<PortalBookAvailability | null>;
  searchBooks(schoolId: string, query: string, take: number): Promise<PortalBookSearchResult[]>;
  findActiveStudentBookLoans(params: PortalActiveStudentBookLoansParams): Promise<PortalActiveBookLoan[]>;
  createBookLoanTransaction(params: PortalCreateBookLoanParams): Promise<{ id: string }>;
  cancelBookLoanTransaction(params: PortalBookLoanMutationParams): Promise<void>;
  returnBookLoanTransaction(params: PortalBookLoanMutationParams): Promise<void>;

  // Staff — Orientation
  findOpenOrientationFicheId(params: PortalOrientationFicheLookup): Promise<string | null>;
  findOpenHighRiskOrientationFiches(params: PortalOrientationRiskLookup): Promise<PortalOrientationRiskFiche[]>;
}
