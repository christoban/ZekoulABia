import type { PrismaClient } from '@prisma/client';
import type { ExamRepository, ExamUpcoming } from '@domain/ports/repositories/ExamRepository';

export class PrismaExamRepository implements ExamRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findUpcomingBySubjects(schoolId: string, subjectIds: string[]): Promise<ExamUpcoming[]> {
    if (subjectIds.length === 0) return [];
    const exams = await this.prisma.exam.findMany({
      where: { schoolId, subjectId: { in: subjectIds }, scheduledAt: { gte: new Date() } },
      select: { id: true, subjectId: true, classId: true },
    });
    return exams as ExamUpcoming[];
  }

  async findBySchool(schoolId: string): Promise<ExamUpcoming[]> {
    const exams = await this.prisma.exam.findMany({
      where: { schoolId },
      select: { id: true, subjectId: true, classId: true },
    });
    return exams as ExamUpcoming[];
  }

  async findById(id: string): Promise<{ id: string; academicYearId: string; scheduledAt: Date | null; duration: number | null } | null> {
    const exam = await this.prisma.exam.findUnique({
      where: { id },
      select: { id: true, academicYearId: true, scheduledAt: true, duration: true },
    });
    return exam;
  }
}
