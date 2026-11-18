/**
 * INFRASTRUCTURE LAYER — Implémentation Prisma de `CopilotAdminOpsGateway`.
 */
import type { PrismaClient } from '@prisma/client';
import type { AttendanceStatus, PebsFiliere } from '@domain/types/enums';
import type {
  CopilotAbsenceStudentRow,
  CopilotAdminOpsGateway,
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
} from '@domain/ports/repositories/copilot/CopilotAdminOpsGateway';
import type { CopilotNamedEntity } from '@domain/ports/repositories/copilot/CopilotSharedGateway';
import { whereProfilesParClasse } from '@application/shared/studentEnrollment';

export class PrismaCopilotAdminOpsGateway implements CopilotAdminOpsGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async findCurrentAcademicYearId(schoolId: string): Promise<{ id: string } | null> {
    return this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
  }

  async findClassPrincipalId(
    schoolId: string,
    classId: string,
  ): Promise<{ professorPrincipalId: string | null } | null> {
    return this.prisma.class.findUnique({
      where: { id: classId, schoolId },
      select: { professorPrincipalId: true },
    });
  }

  async clearClassPrincipal(schoolId: string, classId: string): Promise<void> {
    await this.prisma.class.update({
      where: { id: classId, schoolId },
      data: { professorPrincipalId: null },
    });
  }

  async findClassPrincipal(schoolId: string, classId: string): Promise<CopilotClassPrincipalName | null> {
    const row = await this.prisma.class.findUnique({
      where: { id: classId, schoolId },
      select: { professorPrincipal: { select: { firstName: true, lastName: true } } },
    });
    return row?.professorPrincipal ?? null;
  }

  async countClassDeletionImpact(schoolId: string, classId: string): Promise<CopilotClassDeletionImpact> {
    const [activeEnrollments, grades] = await Promise.all([
      this.prisma.enrollment.count({
        where: { schoolId, classId, status: 'ACTIVE', academicYear: { isCurrent: true } },
      }),
      this.prisma.grade.count({ where: { schoolId, classId } }),
    ]);
    return { activeEnrollments, grades };
  }

  async countSubjectGrades(schoolId: string, subjectId: string): Promise<number> {
    return this.prisma.grade.count({ where: { schoolId, subjectId } });
  }

  async findSubjectEditableFields(schoolId: string, subjectId: string): Promise<CopilotSubjectSnapshot | null> {
    return this.prisma.subject.findUnique({
      where: { id: subjectId, schoolId },
      select: { name: true, coefficient: true, hoursPerWeek: true },
    });
  }

  async softDeleteRooms(schoolId: string, roomIds: string[], deletedById: string): Promise<number> {
    if (roomIds.length === 0) return 0;
    const result = await this.prisma.room.updateMany({
      where: { id: { in: roomIds }, schoolId, deletedAt: null },
      data: { deletedAt: new Date(), deletedById },
    });
    return result.count;
  }

  async findRoomByName(schoolId: string, name: string): Promise<CopilotRoomSnapshot | null> {
    return this.prisma.room.findFirst({
      where: { schoolId, name, deletedAt: null },
      select: { id: true, name: true, type: true, capacity: true, equipment: true, status: true },
    });
  }

  async restoreRoomSnapshot(schoolId: string, roomId: string, snapshot: CopilotRoomRestoreData): Promise<number> {
    const result = await this.prisma.room.updateMany({
      where: { id: roomId, schoolId, deletedAt: null },
      data: {
        name: snapshot.name,
        type: snapshot.type,
        capacity: snapshot.capacity,
        equipment: snapshot.equipment,
        status: snapshot.status,
      },
    });
    return result.count;
  }

  async findActiveClassesByAcademicYear(schoolId: string, academicYearId: string): Promise<CopilotNamedEntity[]> {
    return this.prisma.class.findMany({
      where: { schoolId, academicYearId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });
  }

  async findActiveRoomsBySchool(schoolId: string): Promise<CopilotNamedEntity[]> {
    return this.prisma.room.findMany({
      where: { schoolId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true },
    });
  }

  async findActiveRoomByName(schoolId: string, name: string): Promise<CopilotNamedEntity | null> {
    return this.prisma.room.findFirst({
      where: { schoolId, name, status: 'ACTIVE', deletedAt: null },
      select: { id: true, name: true },
    });
  }

  async findClassRoomAssignments(
    schoolId: string,
    academicYearId: string,
    classIds: string[],
  ): Promise<CopilotClassRoomAssignmentRef[]> {
    if (classIds.length === 0) return [];
    return this.prisma.classRoomAssignment.findMany({
      where: { schoolId, academicYearId, classId: { in: classIds } },
      select: { classId: true, roomId: true },
    });
  }

  async findCepPendingCandidates(schoolId: string): Promise<CopilotCepPendingCandidate[]> {
    const rows = await this.prisma.entranceExamCandidate.findMany({
      where: { admissionStatus: 'ADMIS_PROVISOIRE', session: { schoolId } },
      select: { firstName: true, lastName: true, session: { select: { name: true } } },
    });
    return rows.map((c) => ({ firstName: c.firstName, lastName: c.lastName, sessionName: c.session.name }));
  }

  async findUserBasicIdentity(schoolId: string, userId: string): Promise<CopilotUserIdentitySnapshot | null> {
    return this.prisma.user.findUnique({
      where: { id: userId, schoolId },
      select: { firstName: true, lastName: true, phone: true },
    });
  }

  async findStudentProfileIdByUserId(schoolId: string, userId: string): Promise<{ id: string } | null> {
    return this.prisma.studentProfile.findUnique({
      where: { userId, schoolId },
      select: { id: true },
    });
  }

  async findActiveStudentUserIdsByClass(schoolId: string, classId: string): Promise<string[]> {
    const profiles = await this.prisma.studentProfile.findMany({
      where: { schoolId, ...whereProfilesParClasse(classId) },
      select: { userId: true },
    });
    return profiles.map((p) => p.userId);
  }

  async deleteEntranceExamSession(schoolId: string, sessionId: string): Promise<void> {
    await this.prisma.entranceExamSession.delete({ where: { id: sessionId, schoolId } });
  }

  async deletePebsExamSession(schoolId: string, sessionId: string): Promise<void> {
    await this.prisma.pebsExamSession.delete({ where: { id: sessionId, schoolId } });
  }

  async closeLv2ChoiceWindow(schoolId: string, windowId: string): Promise<void> {
    await this.prisma.lv2ChoiceWindow.update({
      where: { id: windowId, schoolId },
      data: { status: 'CLOSED' },
    });
  }

  async findStudentLv2SubjectId(
    schoolId: string,
    studentUserId: string,
  ): Promise<{ lv2SubjectId: string | null } | null> {
    return this.prisma.studentProfile.findFirst({
      where: { userId: studentUserId, schoolId },
      select: { lv2SubjectId: true },
    });
  }

  async findClassStudentsLv2(schoolId: string, classId: string): Promise<CopilotStudentLv2Row[]> {
    return this.prisma.studentProfile.findMany({
      where: { schoolId, ...whereProfilesParClasse(classId) },
      select: { userId: true, lv2SubjectId: true },
    });
  }

  async findStudentPebsFiliere(
    schoolId: string,
    studentUserId: string,
  ): Promise<{ pebsFiliere: PebsFiliere | null } | null> {
    return this.prisma.studentProfile.findFirst({
      where: { userId: studentUserId, schoolId },
      select: { pebsFiliere: true },
    });
  }

  async findClassStudentsPebs(schoolId: string, classId: string): Promise<CopilotStudentPebsRow[]> {
    return this.prisma.studentProfile.findMany({
      where: { schoolId, ...whereProfilesParClasse(classId) },
      select: { userId: true, pebsFiliere: true },
    });
  }

  async findClassStudentLv2Names(schoolId: string, classId: string): Promise<{ lv2SubjectName: string | null }[]> {
    const profiles = await this.prisma.studentProfile.findMany({
      where: { schoolId, ...whereProfilesParClasse(classId) },
      select: { lv2Subject: { select: { name: true } } },
    });
    return profiles.map((p) => ({ lv2SubjectName: p.lv2Subject?.name ?? null }));
  }

  async findClassStudentsWithoutLv2(schoolId: string, classId: string): Promise<CopilotStudentNameRow[]> {
    const profiles = await this.prisma.studentProfile.findMany({
      where: { schoolId, ...whereProfilesParClasse(classId), lv2SubjectId: null },
      select: { user: { select: { firstName: true, lastName: true } } },
    });
    return profiles.map((p) => ({ firstName: p.user.firstName, lastName: p.user.lastName }));
  }

  async deleteFeePlan(schoolId: string, planId: string): Promise<void> {
    await this.prisma.feePlan.delete({ where: { id: planId, schoolId } });
  }

  async findUnpaidInvoicesForStudent(schoolId: string, studentId: string): Promise<CopilotUnpaidStudentInvoice[]> {
    const factures = await this.prisma.invoice.findMany({
      where: { schoolId, studentId, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
      select: { id: true, amount: true, feePlan: { select: { name: true } } },
    });
    return factures.map((f) => ({ id: f.id, amount: f.amount, feePlanName: f.feePlan?.name ?? null }));
  }

  async findUnpaidInvoicesWithPayments(schoolId: string, studentIds?: string[]): Promise<CopilotUnpaidInvoiceBalance[]> {
    const factures = await this.prisma.invoice.findMany({
      where: {
        schoolId,
        status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        ...(studentIds !== undefined ? { studentId: { in: studentIds } } : {}),
      },
      select: {
        amount: true,
        payments: { where: { status: 'SUCCESS' }, select: { amount: true } },
      },
    });
    return factures.map((f) => ({
      amount: f.amount,
      paidAmount: f.payments.reduce((s, p) => s + p.amount, 0),
    }));
  }

  async findLatestUnjustifiedAbsence(
    schoolId: string,
    studentId: string,
    date?: Date,
  ): Promise<CopilotUnjustifiedAbsenceRecord | null> {
    return this.prisma.attendance.findFirst({
      where: {
        schoolId,
        studentId,
        status: 'ABSENT',
        ...(date !== undefined ? { date } : {}),
      },
      orderBy: { date: 'desc' },
      select: { id: true, date: true },
    });
  }

  async updateAttendanceStatus(schoolId: string, attendanceId: string, status: AttendanceStatus): Promise<void> {
    await this.prisma.attendance.update({
      where: { id: attendanceId, schoolId },
      data: { status },
    });
  }

  async findUnjustifiedAbsencesSince(
    schoolId: string,
    since: Date,
    studentIds?: string[],
  ): Promise<CopilotAbsenceStudentRow[]> {
    const absences = await this.prisma.attendance.findMany({
      where: {
        schoolId,
        status: 'ABSENT',
        date: { gte: since },
        ...(studentIds !== undefined ? { studentId: { in: studentIds } } : {}),
      },
      select: { studentId: true, student: { select: { firstName: true, lastName: true } } },
    });
    return absences.map((a) => ({
      studentId: a.studentId,
      firstName: a.student.firstName,
      lastName: a.student.lastName,
    }));
  }

  async findLatestPendingLeaveRequest(schoolId: string, userId: string): Promise<{ id: string } | null> {
    return this.prisma.leaveRequest.findFirst({
      where: { schoolId, userId, statut: 'PENDING' },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
  }

  async findTeachersWithDiplomas(schoolId: string): Promise<CopilotTeacherDiplomaRow[]> {
    const rows = await this.prisma.user.findMany({
      where: { schoolId, role: 'TEACHER' },
      select: { firstName: true, lastName: true, employeeFile: { select: { diplomes: true } } },
    });
    return rows.map((e) => ({
      firstName: e.firstName,
      lastName: e.lastName,
      diplomes: e.employeeFile?.diplomes ?? null,
    }));
  }

  async findSchoolRiskThresholds(schoolId: string): Promise<CopilotSchoolRiskThresholds | null> {
    return this.prisma.schoolConfig.findUnique({
      where: { schoolId },
      select: { aiRiskThreshold: true, aiRiskThresholdCritical: true },
    });
  }

  async findAtRiskStudents(
    schoolId: string,
    maxHealthScore: number,
    classId?: string,
  ): Promise<CopilotAtRiskStudentRow[]> {
    const rows = await this.prisma.studentProfile.findMany({
      where: {
        schoolId,
        user: { schoolId },
        ...(classId !== undefined ? whereProfilesParClasse(classId) : {}),
        healthScore: { lte: maxHealthScore },
      },
      select: {
        healthScore: true,
        user: { select: { firstName: true, lastName: true } },
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { class: { select: { name: true } } },
          take: 1,
        },
      },
      orderBy: { healthScore: 'asc' },
    });
    return rows.map((e) => ({
      healthScore: e.healthScore,
      firstName: e.user.firstName,
      lastName: e.user.lastName,
      className: e.enrollmentsYearScoped[0]?.class?.name ?? null,
    }));
  }

  async findStudentHealthScore(schoolId: string, studentUserId: string): Promise<{ healthScore: number | null } | null> {
    return this.prisma.studentProfile.findFirst({
      where: { userId: studentUserId, schoolId },
      select: { healthScore: true },
    });
  }

  async findLatestStudentRecommendation(
    schoolId: string,
    studentUserId: string,
    recipientRole: string,
  ): Promise<CopilotStudentRecommendationRow | null> {
    return this.prisma.studentRecommendation.findFirst({
      where: { schoolId, studentId: studentUserId, recipientRole },
      orderBy: { createdAt: 'desc' },
      select: { content: true, contextType: true, createdAt: true },
    });
  }
}
