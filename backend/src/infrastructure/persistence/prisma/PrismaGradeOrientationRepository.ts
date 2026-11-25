import type { PrismaClient } from '@prisma/client';
import type { GradeOrientationRepository, GradeTendanceEntry } from '@domain/ports/repositories/GradeOrientationRepository';

export class PrismaGradeOrientationRepository implements GradeOrientationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findGradesPourTendances(schoolId: string, studentId: string, subjectNames: string[]): Promise<GradeTendanceEntry[]> {
    if (subjectNames.length === 0) return [];
    const grades = await this.prisma.grade.findMany({
      where: {
        schoolId, studentId,
        validationStatus: { in: ['LOCKED'] },
        subject: { name: { in: subjectNames } },
        sequenceAverage: { not: null },
      },
      select: {
        sequenceAverage: true, maxValue: true,
        subject: { select: { name: true } },
        sequence: { select: { academicPeriod: { select: { orderIndex: true, academicYear: { select: { startDate: true } } } } } },
      },
    });
    return grades
      .filter(g => g.sequenceAverage != null && g.sequence?.academicPeriod)
      .map(g => ({
        subjectName: g.subject.name,
        sequenceAverage: g.sequenceAverage!,
        maxValue: g.maxValue,
        orderIndex: g.sequence!.academicPeriod!.orderIndex,
        yearStartTs: g.sequence!.academicPeriod!.academicYear.startDate.getTime(),
      }));
  }

  async findEarliestGradeYearStart(schoolId: string, studentId: string): Promise<Date | null> {
    const earliest = await this.prisma.grade.findFirst({
      where: { schoolId, studentId, validationStatus: { in: ['LOCKED'] } },
      orderBy: { academicYear: { startDate: 'asc' } },
      select: { academicYear: { select: { startDate: true } } },
    });
    return earliest?.academicYear.startDate ?? null;
  }

  async hasValidatedGrade(schoolId: string, studentId: string): Promise<boolean> {
    const found = await this.prisma.grade.findFirst({
      where: { schoolId, studentId, validationStatus: { in: ['LOCKED'] } },
      select: { id: true },
    });
    return !!found;
  }
}
