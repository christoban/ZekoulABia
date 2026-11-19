import type { PrismaClient } from '@prisma/client';
import type {
  SequenceAbsenceSummaryRecord,
  SequenceAbsenceSummaryRepository,
  UpsertSequenceAbsenceSummaryInput,
} from '@domain/ports/repositories/SequenceAbsenceSummaryRepository';

export class PrismaSequenceAbsenceSummaryRepository implements SequenceAbsenceSummaryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async upsertForSequence(input: UpsertSequenceAbsenceSummaryInput): Promise<SequenceAbsenceSummaryRecord> {
    const row = await this.prisma.studentSequenceAbsenceSummary.upsert({
      where: {
        studentId_sequenceId: {
          studentId: input.studentId,
          sequenceId: input.sequenceId,
        },
      },
      create: {
        schoolId: input.schoolId,
        studentId: input.studentId,
        classId: input.classId,
        academicYearId: input.academicYearId,
        academicPeriodId: input.academicPeriodId,
        sequenceId: input.sequenceId,
        justifiedHours: input.justifiedHours,
        unjustifiedHours: input.unjustifiedHours,
        consignesCount: input.consignesCount ?? 0,
        recordedById: input.recordedById,
      },
      update: {
        classId: input.classId,
        academicYearId: input.academicYearId,
        academicPeriodId: input.academicPeriodId,
        justifiedHours: input.justifiedHours,
        unjustifiedHours: input.unjustifiedHours,
        consignesCount: input.consignesCount ?? 0,
        recordedById: input.recordedById,
      },
    });
    return row;
  }

  async upsertBatchForSequence(inputs: UpsertSequenceAbsenceSummaryInput[]): Promise<number> {
    if (inputs.length === 0) return 0;
    let count = 0;
    await this.prisma.$transaction(async (tx) => {
      for (const item of inputs) {
        await tx.studentSequenceAbsenceSummary.upsert({
          where: {
            studentId_sequenceId: {
              studentId: item.studentId,
              sequenceId: item.sequenceId,
            },
          },
          create: {
            schoolId: item.schoolId,
            studentId: item.studentId,
            classId: item.classId,
            academicYearId: item.academicYearId,
            academicPeriodId: item.academicPeriodId,
            sequenceId: item.sequenceId,
            justifiedHours: item.justifiedHours,
            unjustifiedHours: item.unjustifiedHours,
            consignesCount: item.consignesCount ?? 0,
            recordedById: item.recordedById,
          },
          update: {
            classId: item.classId,
            academicYearId: item.academicYearId,
            academicPeriodId: item.academicPeriodId,
            justifiedHours: item.justifiedHours,
            unjustifiedHours: item.unjustifiedHours,
            consignesCount: item.consignesCount ?? 0,
            recordedById: item.recordedById,
          },
        });
        count++;
      }
    });
    return count;
  }

  async findByClassAndPeriods(
    schoolId: string,
    classId: string,
    academicPeriodIds: string[],
  ): Promise<SequenceAbsenceSummaryRecord[]> {
    if (academicPeriodIds.length === 0) return [];
    return this.prisma.studentSequenceAbsenceSummary.findMany({
      where: {
        schoolId,
        classId,
        academicPeriodId: { in: academicPeriodIds },
      },
      orderBy: [{ studentId: 'asc' }, { updatedAt: 'asc' }],
    });
  }
}

