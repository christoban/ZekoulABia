import type { PrismaClient } from '@prisma/client';
import type {
  AIContextQueryRepository,
  StudentWithClass,
  StudentRecommendationDto,
  StudentGradeDto,
  StudentSummary,
  SchoolDto,
  TeacherAssignmentDto,
} from '@domain/ports/repositories/AIContextQueryRepository';
import { whereProfilesParClasse, whereProfilesParClasses } from '@application/shared/studentEnrollment';
import type { StaffPermissionType } from '@domain/types/enums';

export class PrismaAIContextQueryRepository implements AIContextQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getLanguageSousSysteme(schoolId: string): Promise<string | null> {
    const school = await this.prisma.school.findUnique({ where: { id: schoolId }, select: { subsystem: true } });
    return school?.subsystem ?? null;
  }

  async findSchoolById(schoolId: string): Promise<SchoolDto | null> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, subsystem: true, educationType: true, templateCode: true },
    });
    return school as SchoolDto | null;
  }

  async findStudentProfile(userId: string, schoolId: string): Promise<StudentSummary | null> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId, user: { schoolId } },
      include: {
        user: { select: { firstName: true, lastName: true } },
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
          take: 1,
          select: { class: { select: { name: true } } },
        },
      },
    });
    if (!profile) return null;
    return {
      firstName: profile.user.firstName,
      lastName: profile.user.lastName,
      className: profile.enrollmentsYearScoped[0]?.class?.name ?? null,
    };
  }

  async hasTeachingAssignment(teacherId: string, classId: string): Promise<boolean> {
    const assignment = await this.prisma.teachingAssignment.findFirst({ where: { teacherId, classId }, select: { id: true } });
    return !!assignment;
  }

  async isProfesseurPrincipal(classId: string, teacherId: string): Promise<boolean> {
    const cls = await this.prisma.class.findFirst({ where: { id: classId, professorPrincipalId: teacherId }, select: { id: true } });
    return !!cls;
  }

  async hasParentStudentLink(parentUserId: string, studentId: string): Promise<boolean> {
    const lien = await this.prisma.parentStudent.findFirst({
      where: { parentProfile: { userId: parentUserId }, studentProfile: { userId: studentId } },
      select: { parentProfileId: true },
    });
    return !!lien;
  }

  async countStaffWithPermission(schoolId: string, permissions: StaffPermissionType[]): Promise<number> {
    return this.prisma.staffProfile.count({
      where: { schoolId, permissions: { some: { permission: { in: permissions } } } },
    });
  }

  async countStudentProfiles(schoolId: string): Promise<number> {
    return this.prisma.studentProfile.count({ where: { user: { schoolId } } });
  }

  async getRecentValidatedGrades(schoolId: string): Promise<{ sequenceAverage: number | null }[]> {
    return this.prisma.grade.findMany({
      where: { schoolId, validationStatus: { in: ['LOCKED'] } },
      select: { sequenceAverage: true },
      take: 100,
    });
  }

  async getAttendanceStatusCountsSince(schoolId: string, since: Date): Promise<{ status: string; _count: number }[]> {
    const rows = await this.prisma.attendance.groupBy({ by: ['status'], where: { schoolId, date: { gte: since } }, _count: true });
    return rows as unknown as { status: string; _count: number }[];
  }

  async findTeacherProfileWithSubjects(userId: string): Promise<{ teacherSubjects: { subject: { name: string } }[] } | null> {
    const profile = await this.prisma.teacherProfile.findUnique({
      where: { userId },
      include: { teacherSubjects: { include: { subject: true } } },
    });
    const teacherSubjects = profile?.teacherSubjects.map((ts) => ({ subject: { name: ts.subject.name } }));
    return profile ? { teacherSubjects: teacherSubjects ?? [] } : null;
  }

  async findRecentGradesByStudent(schoolId: string, studentId: string): Promise<{ sequenceAverage: number | null; subject: { name: string } }[]> {
    return this.prisma.grade.findMany({
      where: { schoolId, studentId, validationStatus: { in: ['LOCKED'] } },
      include: { subject: true },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });
  }

  async findStudentsByClass(schoolId: string, classId?: string): Promise<StudentWithClass[]> {
    const students = await this.prisma.studentProfile.findMany({
      where: { user: { schoolId }, ...(classId ? whereProfilesParClasse(classId) : {}) },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
          take: 1,
          select: { class: { select: { id: true, name: true } } },
        },
      },
      orderBy: { healthScore: 'asc' },
    });
    return students.map((s) => ({
      userId: s.user.id,
      firstName: s.user.firstName,
      lastName: s.user.lastName,
      classId: s.enrollmentsYearScoped[0]?.class?.id ?? null,
      className: s.enrollmentsYearScoped[0]?.class?.name ?? null,
      healthScore: s.healthScore,
    }));
  }

  async findStudentsByClasses(classIds: string[], options?: { healthScoreLte?: number }): Promise<StudentWithClass[]> {
    const students = await this.prisma.studentProfile.findMany({
      where: { ...whereProfilesParClasses(classIds), ...(options?.healthScoreLte != null ? { healthScore: { lte: options.healthScoreLte } } : {}) },
      include: {
        user: { select: { id: true, firstName: true, lastName: true } },
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
          take: 1,
          select: { class: { select: { id: true, name: true } } },
        },
      },
      orderBy: { healthScore: 'asc' },
    });
    return students.map((s) => ({
      userId: s.user.id,
      firstName: s.user.firstName,
      lastName: s.user.lastName,
      classId: s.enrollmentsYearScoped[0]?.class?.id ?? null,
      className: s.enrollmentsYearScoped[0]?.class?.name ?? null,
      healthScore: s.healthScore,
    }));
  }

  async findStudentHealthScores(studentIds: string[]): Promise<{ userId: string; healthScore: number | null }[]> {
    return this.prisma.studentProfile.findMany({
      where: { userId: { in: studentIds } },
      select: { userId: true, healthScore: true },
    });
  }

  async findParentChildren(parentUserId: string): Promise<{ studentId: string; firstName: string; lastName: string | null; className: string | null }[]> {
    const parentProfile = await this.prisma.parentProfile.findUnique({
      where: { userId: parentUserId },
      include: {
        children: {
          include: {
            studentProfile: {
              include: {
                user: { select: { firstName: true, lastName: true } },
                enrollmentsYearScoped: {
                  where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
                  take: 1,
                  select: { class: { select: { name: true } } },
                },
              },
            },
          },
        },
      },
    });
    return (parentProfile?.children ?? [])
      .filter((c) => c.studentProfile)
      .map((c) => ({
        studentId: c.studentProfile!.userId,
        firstName: c.studentProfile!.user.firstName,
        lastName: c.studentProfile!.user.lastName,
        className: c.studentProfile!.enrollmentsYearScoped[0]?.class?.name ?? null,
      }));
  }

  async getSchoolConfig(schoolId: string): Promise<{ aiRiskThreshold: number | null; aiRiskThresholdCritical: number | null } | null> {
    return this.prisma.schoolConfig
      .findUnique({ where: { schoolId }, select: { aiRiskThreshold: true, aiRiskThresholdCritical: true } })
      .catch(() => null)
      .then((c) => (c ? { aiRiskThreshold: c.aiRiskThreshold, aiRiskThresholdCritical: c.aiRiskThresholdCritical } : null));
  }

  async findStudentRecommendations(input: {
    schoolId?: string;
    studentIds: string[];
    recipientRole: string;
    contextTypes?: string[];
    since?: Date;
  }): Promise<StudentRecommendationDto[]> {
    const { schoolId, studentIds, recipientRole, contextTypes, since } = input;
    const rows = await this.prisma.studentRecommendation.findMany({
      where: {
        ...(schoolId ? { schoolId } : {}),
        studentId: { in: studentIds },
        recipientRole,
        ...(contextTypes ? { contextType: { in: contextTypes } } : {}),
        ...(since ? { createdAt: { gte: since } } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      studentId: r.studentId,
      recipientRole: r.recipientRole,
      contextType: r.contextType,
      subjectId: r.subjectId,
      content: r.content,
      createdAt: r.createdAt,
    }));
  }

  async findTeachingAssignmentsByTeacher(teacherId: string, schoolId: string): Promise<TeacherAssignmentDto[]> {
    const assignments = await this.prisma.teachingAssignment.findMany({
      where: { teacherId, schoolId },
      select: { classId: true, subjectId: true, subject: { select: { name: true } } },
    });
    return assignments.map((a) => ({ classId: a.classId, subjectId: a.subjectId, subjectName: a.subject.name }));
  }

  async findClassesByProfesseurPrincipal(teacherId: string, schoolId: string): Promise<{ id: string }[]> {
    return this.prisma.class.findMany({ where: { schoolId, professorPrincipalId: teacherId }, select: { id: true } });
  }

  async findGradesByStudent(schoolId: string, studentId: string): Promise<StudentGradeDto[]> {
    const grades = await this.prisma.grade.findMany({
      where: { schoolId, studentId, validationStatus: { in: ['LOCKED'] } },
      include: { subject: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return grades.map((g) => ({ sequenceAverage: g.sequenceAverage, subjectName: g.subject.name }));
  }

  async findAttendanceStatuses(schoolId: string, studentId: string, since: Date): Promise<{ status: string }[]> {
    return this.prisma.attendance.findMany({
      where: { schoolId, studentId, date: { gte: since } },
      select: { status: true },
    });
  }

  async findClassesBySchool(schoolId: string): Promise<{ name: string }[]> {
    return this.prisma.class.findMany({ where: { schoolId }, select: { name: true }, orderBy: { name: 'asc' }, take: 60 });
  }

  async findSubjectsBySchool(schoolId: string): Promise<{ name: string; coefficient: number }[]> {
    return this.prisma.subject.findMany({ where: { schoolId }, select: { name: true, coefficient: true }, orderBy: { name: 'asc' }, take: 80 });
  }

  async findDepartmentsBySchool(schoolId: string): Promise<{ name: string }[]> {
    return this.prisma.department.findMany({ where: { schoolId }, select: { name: true } });
  }

  async findCurrentPeriods(schoolId: string): Promise<{ name: string }[]> {
    return this.prisma.academicPeriod.findMany({ where: { academicYear: { schoolId, isCurrent: true } }, select: { name: true }, orderBy: { orderIndex: 'asc' } });
  }

  async findCurrentAcademicYear(schoolId: string): Promise<{ id: string } | null> {
    return this.prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } });
  }
}
