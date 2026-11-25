/**
 * INFRASTRUCTURE LAYER — Implémentation Prisma de `CopilotPortalGateway`.
 */
import type { PrismaClient } from '@prisma/client';
import type { AttendanceStatus } from '@domain/types/enums';
import { whereProfilesParClasse } from '@application/shared/studentEnrollment';
import type {
  CopilotPortalGateway,
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
} from '@domain/ports/repositories/copilot/CopilotPortalGateway';
import * as staffOps from './prismaPortalStaffOps';

export class PrismaCopilotPortalGateway implements CopilotPortalGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async findParentChildren(schoolId: string, parentUserId: string): Promise<PortalParentChild[] | null> {
    const parentProfile = await this.prisma.parentProfile.findFirst({
      where: { userId: parentUserId, user: { schoolId } },
      select: { id: true },
    });
    if (!parentProfile) return null;
    const liens = await this.prisma.parentStudent.findMany({
      where: { parentProfileId: parentProfile.id, studentProfile: { user: { schoolId } } },
      select: {
        studentProfile: {
          select: {
            id: true,
            userId: true,
            enrollmentsYearScoped: {
              where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
              select: { class: { select: { name: true } } },
              take: 1,
            },
            user: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    return liens.map((l) => ({
      studentUserId: l.studentProfile.userId,
      studentProfileId: l.studentProfile.id,
      firstName: l.studentProfile.user.firstName,
      lastName: l.studentProfile.user.lastName,
      className: l.studentProfile.enrollmentsYearScoped[0]?.class?.name ?? null,
    }));
  }

  async findStudentUnpaidInvoices(schoolId: string, studentId: string): Promise<PortalUnpaidInvoice[]> {
    const factures = await this.prisma.invoice.findMany({
      where: { schoolId, studentId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      select: {
        id: true,
        amount: true,
        feePlan: { select: { name: true } },
        payments: { where: { status: 'SUCCESS' }, select: { amount: true } },
      },
    });
    return factures.map((f) => ({
      id: f.id,
      amount: f.amount,
      feePlanName: f.feePlan?.name ?? null,
      successfulPaymentsTotal: f.payments.reduce((s, p) => s + p.amount, 0),
    }));
  }

  async findRecentStudentGrades(params: PortalRecentStudentGradesParams): Promise<PortalStudentRecentGrade[]> {
    const grades = await this.prisma.grade.findMany({
      where: {
        schoolId: params.schoolId,
        studentId: params.studentId,
        sequenceAverage: { not: null },
        ...(params.subjectNameContains
          ? { subject: { name: { contains: params.subjectNameContains, mode: 'insensitive' } } }
          : {}),
      },
      orderBy: { id: 'desc' },
      take: params.take,
      select: { sequenceAverage: true, subject: { select: { name: true } }, sequence: { select: { name: true } } },
    });
    return grades.flatMap((g) =>
      g.sequenceAverage === null
        ? []
        : [{ sequenceAverage: g.sequenceAverage, subjectName: g.subject.name, sequenceName: g.sequence.name }],
    );
  }

  async findStudentSequenceGrades(
    schoolId: string,
    studentId: string,
    sequenceId: string,
  ): Promise<PortalStudentSequenceGrade[]> {
    const grades = await this.prisma.grade.findMany({
      where: { schoolId, studentId, sequenceId, sequenceAverage: { not: null } },
      select: { sequenceAverage: true, coefficient: true, isAbsentGrade: true },
    });
    return grades.flatMap((g) =>
      g.sequenceAverage === null
        ? []
        : [{ sequenceAverage: g.sequenceAverage, coefficient: g.coefficient, isAbsentGrade: g.isAbsentGrade }],
    );
  }

  private buildAttendanceWhere(filter: PortalAttendanceFilter) {
    return {
      schoolId: filter.schoolId,
      date: { gte: filter.since },
      ...(filter.studentId !== undefined ? { studentId: filter.studentId } : {}),
      ...(filter.classId !== undefined ? { classId: filter.classId } : {}),
      ...(filter.teacherId !== undefined ? { teacherId: filter.teacherId } : {}),
      ...(filter.statuses !== undefined ? { status: { in: filter.statuses } } : {}),
    };
  }

  async countAttendancesSince(filter: PortalAttendanceFilter): Promise<number> {
    return this.prisma.attendance.count({ where: this.buildAttendanceWhere(filter) });
  }

  async findAttendanceStatusesSince(
    filter: Omit<PortalAttendanceFilter, 'statuses'>,
  ): Promise<Array<{ status: AttendanceStatus }>> {
    return this.prisma.attendance.findMany({
      where: this.buildAttendanceWhere(filter),
      select: { status: true },
    });
  }

  async hasTeacherAssignment(params: PortalTeacherAssignmentCheck): Promise<boolean> {
    const assignment = await this.prisma.teachingAssignment.findFirst({
      where: {
        schoolId: params.schoolId,
        teacherId: params.teacherId,
        classId: params.classId,
        ...(params.subjectId !== undefined ? { subjectId: params.subjectId } : {}),
      },
      select: { id: true },
    });
    return assignment !== null;
  }

  async findTeacherAssignments(schoolId: string, teacherId: string): Promise<PortalTeacherAssignment[]> {
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { teacherId, schoolId },
      select: { class: { select: { name: true } }, subject: { select: { name: true } } },
    });
    return assignments.map((a) => ({ className: a.class.name, subjectName: a.subject.name }));
  }

  async findStudentsInClass(schoolId: string, classId: string): Promise<PortalPersonName[]> {
    return this.prisma.user.findMany({
      where: { schoolId, role: 'STUDENT', studentProfile: { ...whereProfilesParClasse(classId) } },
      select: { firstName: true, lastName: true },
      orderBy: { lastName: 'asc' },
    });
  }

  async getTeacherGradeEntryProgress(params: PortalTeacherGradeProgressParams): Promise<PortalTeacherGradeProgress> {
    const [totalStudents, draftCount, recordedCount] = await Promise.all([
      this.prisma.enrollment.count({
        where: { schoolId: params.schoolId, classId: params.classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
      }),
      this.prisma.grade.count({
        where: {
          schoolId: params.schoolId,
          classId: params.classId,
          subjectId: params.subjectId,
          sequenceId: params.sequenceId,
          recordedById: params.teacherId,
          validationStatus: 'DRAFT',
        },
      }),
      this.prisma.grade.count({
        where: {
          schoolId: params.schoolId,
          classId: params.classId,
          subjectId: params.subjectId,
          sequenceId: params.sequenceId,
          recordedById: params.teacherId,
        },
      }),
    ]);
    return { totalStudents, draftCount, recordedCount };
  }

  async findClassSubjectSequenceGrades(
    params: PortalClassSubjectSequenceGradesParams,
  ): Promise<PortalClassSubjectSequenceGrade[]> {
    return this.prisma.grade.findMany({
      where: {
        schoolId: params.schoolId,
        classId: params.classId,
        subjectId: params.subjectId,
        sequenceId: params.sequenceId,
        sequenceAverage: { not: null },
      },
      select: { sequenceAverage: true, isAbsentGrade: true },
    });
  }

  async deleteGradeById(schoolId: string, gradeId: string): Promise<void> {
    await this.prisma.grade.delete({ where: { id: gradeId, schoolId } });
  }

  async findLatestAttendanceId(params: PortalLatestAttendanceParams): Promise<string | null> {
    const record = await this.prisma.attendance.findFirst({
      where: {
        schoolId: params.schoolId,
        studentId: params.studentId,
        classId: params.classId,
        date: params.date,
        period: params.period,
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    return record?.id ?? null;
  }

  async deleteAttendanceById(schoolId: string, attendanceId: string): Promise<void> {
    await this.prisma.attendance.delete({ where: { id: attendanceId, schoolId } });
  }

  async createCahierDeTexteEntry(params: PortalCreateCahierDeTexteParams): Promise<{ id: string }> {
    return this.prisma.cahierDeTexte.create({
      data: {
        schoolId: params.schoolId,
        teacherId: params.teacherId,
        classId: params.classId,
        subjectId: params.subjectId,
        academicYearId: params.academicYearId,
        date: params.date,
        contenuLibre: params.contenuLibre,
        devoirsDonnes: params.devoirsDonnes,
      },
      select: { id: true },
    });
  }

  async deleteCahierDeTexteEntry(schoolId: string, entryId: string): Promise<void> {
    await this.prisma.cahierDeTexte.delete({ where: { id: entryId, schoolId } });
  }

  createDisciplineRecord(params: PortalCreateDisciplineRecordParams): Promise<{ id: string }> {
    return staffOps.createDisciplineRecord(this.prisma, params);
  }

  findLatestActiveDisciplineRecord(schoolId: string, studentId: string): Promise<PortalActiveDisciplineRecord | null> {
    return staffOps.findLatestActiveDisciplineRecord(this.prisma, schoolId, studentId);
  }

  liftDisciplineRecordById(schoolId: string, recordId: string): Promise<void> {
    return staffOps.liftDisciplineRecordById(this.prisma, schoolId, recordId);
  }

  findRecentDisciplineRecords(
    schoolId: string,
    studentId: string,
    take: number,
  ): Promise<PortalDisciplineRecordSummary[]> {
    return staffOps.findRecentDisciplineRecords(this.prisma, schoolId, studentId, take);
  }

  deleteApeeTransactionById(schoolId: string, transactionId: string): Promise<void> {
    return staffOps.deleteApeeTransactionById(this.prisma, schoolId, transactionId);
  }

  findPendingApeeExpenseByDescription(
    schoolId: string,
    descriptionContains: string,
  ): Promise<PortalPendingApeeExpense | null> {
    return staffOps.findPendingApeeExpenseByDescription(this.prisma, schoolId, descriptionContains);
  }

  getApeeBalanceSummary(schoolId: string): Promise<PortalApeeBalanceSummary> {
    return staffOps.getApeeBalanceSummary(this.prisma, schoolId);
  }

  findBookByTitleContains(schoolId: string, titleContains: string): Promise<PortalBookAvailability | null> {
    return staffOps.findBookByTitleContains(this.prisma, schoolId, titleContains);
  }

  searchBooks(schoolId: string, query: string, take: number): Promise<PortalBookSearchResult[]> {
    return staffOps.searchBooks(this.prisma, schoolId, query, take);
  }

  findActiveStudentBookLoans(params: PortalActiveStudentBookLoansParams): Promise<PortalActiveBookLoan[]> {
    return staffOps.findActiveStudentBookLoans(this.prisma, params);
  }

  createBookLoanTransaction(params: PortalCreateBookLoanParams): Promise<{ id: string }> {
    return staffOps.createBookLoanTransaction(this.prisma, params);
  }

  cancelBookLoanTransaction(params: PortalBookLoanMutationParams): Promise<void> {
    return staffOps.cancelBookLoanTransaction(this.prisma, params);
  }

  returnBookLoanTransaction(params: PortalBookLoanMutationParams): Promise<void> {
    return staffOps.returnBookLoanTransaction(this.prisma, params);
  }

  findOpenOrientationFicheId(params: PortalOrientationFicheLookup): Promise<string | null> {
    return staffOps.findOpenOrientationFicheId(this.prisma, params);
  }

  findOpenHighRiskOrientationFiches(params: PortalOrientationRiskLookup): Promise<PortalOrientationRiskFiche[]> {
    return staffOps.findOpenHighRiskOrientationFiches(this.prisma, params);
  }
}
