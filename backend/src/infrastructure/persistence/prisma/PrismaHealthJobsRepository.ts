import type { PrismaClient, StaffPermissionType as PrismaStaffPermissionType } from '@prisma/client';
import type {
  HealthJobsRepository,
  StudentContext,
  SchoolConfigHealth,
  RecommendationCreateData,
  DigestStudentHealth,
} from '@domain/ports/repositories/HealthJobsRepository';

export class PrismaHealthJobsRepository implements HealthJobsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActiveSchools(): Promise<{ id: string }[]> {
    return this.prisma.school.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  }

  async getSchoolConfig(schoolId: string): Promise<SchoolConfigHealth | null> {
    try {
      const cfg = await this.prisma.schoolConfig.findFirst({
        where: { schoolId },
        select: { aiAlertsEnabled: true, aiRiskThreshold: true, aiRiskThresholdCritical: true },
      });
      return cfg as SchoolConfigHealth | null;
    } catch {
      return null;
    }
  }

  async findCurrentAcademicYear(schoolId: string): Promise<{ id: string } | null> {
    return this.prisma.academicYear.findFirst({ where: { schoolId, isCurrent: true }, select: { id: true } });
  }

  async findStudentIdsForSchool(schoolId: string): Promise<{ userId: string }[]> {
    return this.prisma.studentProfile.findMany({
      where: { user: { schoolId } },
      select: { userId: true },
    });
  }

  async findStudentContext(studentId: string, schoolId: string): Promise<StudentContext> {
    const profile = await this.prisma.studentProfile.findFirst({
      where: { userId: studentId, user: { schoolId } },
      select: {
        user: { select: { firstName: true, lastName: true } },
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
          take: 1,
          select: { classId: true, class: { select: { name: true, professorPrincipalId: true } } },
        },
      },
    });
    return {
      nomComplet: profile ? `${profile.user.firstName} ${profile.user.lastName}` : "Élève",
      classId: profile?.enrollmentsYearScoped[0]?.classId ?? null,
      className: profile?.enrollmentsYearScoped[0]?.class?.name ?? null,
      professorPrincipalId: profile?.enrollmentsYearScoped[0]?.class?.professorPrincipalId ?? null,
    };
  }

  async createRecommendation(data: RecommendationCreateData): Promise<void> {
    await this.prisma.studentRecommendation.create({
      data: {
        schoolId: data.schoolId,
        studentId: data.studentId,
        subjectId: data.subjectId ?? null,
        recipientRole: data.recipientRole,
        contextType: data.contextType,
        content: data.content,
      },
    });
  }

  async countCriticalRecommendations(studentId: string, schoolId: string, since: Date): Promise<number> {
    return this.prisma.studentRecommendation.count({
      where: { studentId, schoolId, recipientRole: "STUDENT", contextType: "HEALTH_CRITICAL", createdAt: { gte: since } },
    });
  }

  async findFicheOrientation(studentId: string, academicYearId: string): Promise<{ id: string } | null> {
    return this.prisma.ficheOrientation.findFirst({
      where: { studentId, academicYearId },
      select: { id: true },
    });
  }

  async findStaffByPermission(schoolId: string, permission: string): Promise<{ userId: string }[]> {
    return this.prisma.staffProfile.findMany({
      where: { schoolId, permissions: { some: { permission: permission as PrismaStaffPermissionType } } },
      select: { userId: true },
    }).catch(() => []);
  }

  async findStudentsWithHealthScoreLte(schoolId: string, threshold: number): Promise<DigestStudentHealth[]> {
    return this.prisma.studentProfile.findMany({
      where: { user: { schoolId }, healthScore: { lte: threshold } },
      select: {
        healthScore: true,
        user: { select: { firstName: true, lastName: true } },
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
          take: 1,
          select: { class: { select: { name: true, professorPrincipalId: true } } },
        },
      },
    }) as unknown as DigestStudentHealth[];
  }

  async findTeacherRecommendationsSince(schoolId: string, since: Date): Promise<{ studentId: string; subjectId: string | null }[]> {
    return this.prisma.studentRecommendation.findMany({
      where: { schoolId, recipientRole: "TEACHER", contextType: "SUBJECT_DROP", createdAt: { gte: since } },
      select: { studentId: true, subjectId: true },
    });
  }

  async findStudentProfilesForDigest(schoolId: string, studentIds: string[]): Promise<Array<{
    userId: string;
    user: { firstName: string; lastName: string };
    enrollmentsYearScoped: { class: { name: string; professorPrincipalId: string | null } }[];
  }>> {
    const rows = await this.prisma.studentProfile.findMany({
      where: { userId: { in: studentIds }, user: { schoolId } },
      select: {
        userId: true,
        user: { select: { firstName: true, lastName: true } },
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE' as const, academicYear: { isCurrent: true } },
          take: 1,
          select: { class: { select: { name: true, professorPrincipalId: true } } },
        },
      },
    });
    return rows;
  }

  async findSubjectsByIds(subjectIds: string[]): Promise<{ id: string; name: string }[]> {
    if (subjectIds.length === 0) return [];
    return this.prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true, name: true } });
  }
}
