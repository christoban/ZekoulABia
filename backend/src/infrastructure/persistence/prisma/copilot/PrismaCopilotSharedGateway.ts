/**
 * INFRASTRUCTURE LAYER — Implémentation Prisma de `CopilotSharedGateway`.
 */
import type { PrismaClient } from '@prisma/client';
import type {
  CopilotFeePlanCandidate,
  CopilotNamedEntity,
  CopilotPersonEntity,
  CopilotSequenceGradeRow,
  CopilotSharedGateway,
  CopilotStudentCandidate,
} from '@domain/ports/repositories/copilot/CopilotSharedGateway';

export class PrismaCopilotSharedGateway implements CopilotSharedGateway {
  constructor(private readonly prisma: PrismaClient) {}

  async findClassesBySchool(schoolId: string): Promise<CopilotNamedEntity[]> {
    return this.prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    });
  }

  async findTeachersBySchool(schoolId: string): Promise<CopilotPersonEntity[]> {
    return this.prisma.user.findMany({
      where: { schoolId, role: 'TEACHER' },
      select: { id: true, firstName: true, lastName: true },
    });
  }

  async findSubjectsBySchool(schoolId: string): Promise<CopilotNamedEntity[]> {
    return this.prisma.subject.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    });
  }

  async findStudentsBySchool(schoolId: string): Promise<CopilotStudentCandidate[]> {
    const students = await this.prisma.user.findMany({
      where: { schoolId, role: 'STUDENT' },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        studentProfile: {
          select: {
            enrollmentsYearScoped: {
              where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
              select: { class: { select: { name: true } } },
              take: 1,
            },
          },
        },
      },
    });
    return students.map((s) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      className: s.studentProfile?.enrollmentsYearScoped?.[0]?.class?.name ?? null,
    }));
  }

  async findEmployeesBySchool(schoolId: string): Promise<CopilotPersonEntity[]> {
    return this.prisma.user.findMany({
      where: { schoolId, role: { in: ['TEACHER', 'STAFF'] } },
      select: { id: true, firstName: true, lastName: true },
    });
  }

  async findFeePlansBySchool(schoolId: string): Promise<CopilotFeePlanCandidate[]> {
    return this.prisma.feePlan.findMany({
      where: { schoolId },
      select: { id: true, name: true, amount: true },
    });
  }

  async findEntranceExamSessionsBySchool(schoolId: string): Promise<CopilotNamedEntity[]> {
    return this.prisma.entranceExamSession.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    });
  }

  async findPebsExamSessionsBySchool(schoolId: string): Promise<CopilotNamedEntity[]> {
    return this.prisma.pebsExamSession.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    });
  }

  async findCurrentAcademicYear(schoolId: string): Promise<CopilotNamedEntity | null> {
    return this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true, name: true },
    });
  }

  async findCurrentAcademicPeriod(schoolId: string): Promise<CopilotNamedEntity | null> {
    return this.prisma.academicPeriod.findFirst({
      where: { academicYear: { schoolId, isCurrent: true }, isCurrent: true },
      select: { id: true, name: true },
    });
  }

  async findCurrentAcademicSequence(schoolId: string): Promise<CopilotNamedEntity | null> {
    return this.prisma.academicSequence.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true, name: true },
    });
  }

  async findSchoolSubsystem(schoolId: string): Promise<{ subsystem: string } | null> {
    return this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { subsystem: true },
    });
  }

  async findClassLevel(schoolId: string, classId: string): Promise<{ level: string | null } | null> {
    return this.prisma.class.findUnique({
      where: { id: classId, schoolId },
      select: { level: true },
    });
  }

  async findClassSequenceGrades(
    schoolId: string,
    classId: string,
    sequenceId: string,
  ): Promise<CopilotSequenceGradeRow[]> {
    return this.prisma.grade.findMany({
      where: { classId, sequenceId, schoolId, sequenceAverage: { not: null } },
      select: { studentId: true, sequenceAverage: true, coefficient: true, isAbsentGrade: true },
    });
  }
}
