import type { PrismaClient } from '@prisma/client';
import type {
  StatisticsQueryRepository,
  GradeEvolutionRow,
  ClassRow,
  ClassComparisonGradeRow,
  StudentsLevelRow,
  InvoicePayRow,
  TeacherRow,
  TeachingAssignmentRow,
  TeacherGradeRow,
  AttendanceRow,
} from '@domain/ports/repositories/StatisticsQueryRepository';

const GRADE_STATUSES_VALIDES = ['LOCKED'] as const;

export class PrismaStatisticsQueryRepository implements StatisticsQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findCurrentAcademicYear(schoolId: string): Promise<{ id: string } | null> {
    return this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
  }

  async findGradesEvolution(
    schoolId: string,
    academicYearId: string,
    f: { classId?: string; subjectId?: string; studentId?: string }
  ): Promise<GradeEvolutionRow[]> {
    return this.prisma.grade.findMany({
      where: {
        schoolId,
        academicYearId,
        validationStatus: { in: [...GRADE_STATUSES_VALIDES] },
        ...(f.classId ? { classId: f.classId } : {}),
        ...(f.subjectId ? { subjectId: f.subjectId } : {}),
        ...(f.studentId ? { studentId: f.studentId } : {}),
      },
      select: {
        sequenceAverage: true,
        sequence: {
          select: {
            id: true,
            name: true,
            orderIndex: true,
            academicPeriod: { select: { name: true } },
          },
        },
      },
    });
  }

  async findClassesByLevel(schoolId: string, level?: string): Promise<ClassRow[]> {
    return this.prisma.class.findMany({
      where: { schoolId, ...(level ? { level } : {}) },
      select: { id: true, name: true, level: true },
      orderBy: { name: 'asc' },
    });
  }

  async findGradesForClassComparison(
    schoolId: string,
    academicYearId: string,
    classIds: string[]
  ): Promise<ClassComparisonGradeRow[]> {
    return this.prisma.grade.findMany({
      where: {
        schoolId,
        academicYearId,
        classId: { in: classIds },
        validationStatus: { in: [...GRADE_STATUSES_VALIDES] },
      },
      select: { classId: true, studentId: true, sequenceAverage: true },
    });
  }

  async findStudentsGenderDistribution(schoolId: string): Promise<{ gender: string | null }[]> {
    return this.prisma.studentProfile.findMany({
      where: { studentStatus: 'ACTIVE', user: { schoolId } },
      select: { gender: true },
    });
  }

  async findStudentsLevelDistribution(schoolId: string): Promise<StudentsLevelRow[]> {
    return this.prisma.studentProfile.findMany({
      where: { studentStatus: 'ACTIVE', user: { schoolId } },
      select: {
        enrollmentsYearScoped: {
          where: { status: 'ACTIVE', academicYear: { isCurrent: true } },
          select: { class: { select: { level: true } } },
          take: 1,
        },
      },
    });
  }

  async findInvoicesPaymentStatuses(schoolId: string): Promise<InvoicePayRow[]> {
    return this.prisma.invoice.findMany({
      where: { schoolId, status: { not: 'CANCELLED' } },
      select: { studentId: true, status: true },
    });
  }

  async findTeacherById(schoolId: string, teacherId: string): Promise<TeacherRow | null> {
    return this.prisma.user.findFirst({
      where: { id: teacherId, schoolId, role: 'TEACHER' },
      select: { id: true, firstName: true, lastName: true },
    });
  }

  async findTeachingAssignmentsForTeacher(schoolId: string, teacherId: string): Promise<TeachingAssignmentRow[]> {
    return this.prisma.teachingAssignment.findMany({
      where: { teacherId, schoolId },
      select: {
        subjectId: true,
        classId: true,
        subject: { select: { name: true, hoursPerWeek: true } },
        class: { select: { name: true } },
      },
    });
  }

  async findGradesForTeacherPerformance(
    schoolId: string,
    subjectIds: string[],
    classIds: string[]
  ): Promise<TeacherGradeRow[]> {
    return this.prisma.grade.findMany({
      where: {
        schoolId,
        subjectId: { in: subjectIds },
        classId: { in: classIds },
        validationStatus: { in: [...GRADE_STATUSES_VALIDES] },
      },
      select: { subjectId: true, classId: true, sequenceAverage: true },
    });
  }

  async findAttendanceForTeacher(schoolId: string, teacherId: string, classIds: string[]): Promise<AttendanceRow[]> {
    return this.prisma.attendance.findMany({
      where: { schoolId, teacherId, classId: { in: classIds } },
      select: { status: true, date: true, classId: true, subjectId: true },
    });
  }
}
