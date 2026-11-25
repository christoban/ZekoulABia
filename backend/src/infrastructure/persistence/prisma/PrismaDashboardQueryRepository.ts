import type { PrismaClient } from '@prisma/client';
import type { DashboardQueryRepository, DashboardCounts, AdminBadges, TeacherSlots, StudentDashboard } from '@domain/ports/repositories/DashboardQueryRepository';

export class PrismaDashboardQueryRepository implements DashboardQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findRecentActivities(schoolId: string, userId: string, isAdmin: boolean, take: number): Promise<Array<{ action: string; createdAt: Date }>> {
    return this.prisma.activitiesLog.findMany({
      where: { ...(schoolId ? { schoolId } : {}), ...(!isAdmin ? { userId } : {}) },
      orderBy: { createdAt: 'desc' },
      take,
      select: { action: true, createdAt: true },
    });
  }

  async countAdminStats(schoolId: string): Promise<DashboardCounts> {
    const currentYear = schoolId
      ? await this.prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } })
      : null;
    const [totalStudents, totalTeachers, activeExams, presentAttendance, totalAttendance, pendingTeachingIssues] = await Promise.all([
      this.prisma.user.count({ where: { ...(schoolId ? { schoolId } : {}), role: 'STUDENT' } }),
      this.prisma.user.count({ where: { ...(schoolId ? { schoolId } : {}), role: 'TEACHER' } }),
      this.prisma.harmonizedAssessmentSession.count({ where: { ...(schoolId ? { schoolId } : {}), status: { in: ['PLANNED', 'IN_PROGRESS'] } } }),
      this.prisma.attendance.count({ where: { ...(schoolId ? { schoolId } : {}), status: { in: ['PRESENT', 'LATE'] } } }),
      this.prisma.attendance.count({ where: { ...(schoolId ? { schoolId } : {}) } }),
      currentYear
        ? this.prisma.teachingAssignmentIssue.count({ where: { schoolId, academicYearId: currentYear.id, status: 'OPEN' } })
        : Promise.resolve(0),
    ]);
    return { totalStudents, totalTeachers, activeExams, presentAttendance, totalAttendance, pendingTeachingIssues };
  }

  async countAdminBadges(schoolId: string): Promise<AdminBadges> {
    const currentYear = await this.prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } });
    const [users, classes, pendingGrades, pendingInvoices, pendingOnboardings, pendingTeachingIssues] = await Promise.all([
      this.prisma.user.count({ where: { schoolId } }),
      this.prisma.class.count({ where: { schoolId } }),
      this.prisma.grade.count({ where: { schoolId, validationStatus: 'DRAFT' } }),
      this.prisma.invoice.count({ where: { schoolId, status: { in: ['PENDING', 'OVERDUE'] } } }),
      this.prisma.studentOnboarding.count({ where: { schoolId, status: 'SUBMITTED' } }),
      currentYear
        ? this.prisma.teachingAssignmentIssue.count({ where: { schoolId, academicYearId: currentYear.id, status: 'OPEN' } })
        : Promise.resolve(0),
    ]);
    return { users, classes, pendingGrades, pendingInvoices, pendingOnboardings, pendingTeachingIssues };
  }

  async findTeacherDashboard(schoolId: string, teacherId: string): Promise<TeacherSlots> {
    const myClasses = await this.prisma.class.findMany({ where: { ...(schoolId ? { schoolId } : {}) }, select: { id: true, name: true } });
    const todaySlots = await this.prisma.timetableSlot.findMany({
      where: { dayOfWeek: new Date().getDay(), teacherId },
      include: { timetable: { include: { class: { select: { name: true } } } }, subject: { select: { name: true } } },
      orderBy: { startTime: 'asc' },
    });
    return {
      myClasses,
      todaySlots: todaySlots.map(s => ({ subjectName: s.subject?.name ?? null, className: s.timetable?.class?.name ?? null })),
    };
  }

  async findStudentDashboard(studentId: string): Promise<StudentDashboard> {
    const [presenceCount, totalPresence, grades] = await Promise.all([
      this.prisma.attendance.count({ where: { studentId, status: { in: ['PRESENT', 'LATE'] } } }),
      this.prisma.attendance.count({ where: { studentId } }),
      this.prisma.grade.findMany({
        where: { studentId, validationStatus: { in: ['LOCKED'] } },
        select: { sequenceAverage: true },
        take: 10,
      }),
    ]);
    return { presenceCount, totalPresence, recentGrades: grades.map(g => g.sequenceAverage ?? 0) };
  }
}
