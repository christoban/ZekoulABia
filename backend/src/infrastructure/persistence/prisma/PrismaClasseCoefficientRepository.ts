import type { PrismaClient } from '@prisma/client';
import type {
  ClasseCoefficientRepository,
  ClassSubjectOverrideRecord,
  SubjectCoefficientRecord,
} from '@domain/ports/repositories/ClasseCoefficientRepository';

export class PrismaClasseCoefficientRepository implements ClasseCoefficientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOverride(classId: string, subjectId: string): Promise<ClassSubjectOverrideRecord | null> {
    return this.prisma.classSubjectOverride.findUnique({
      where: { classId_subjectId: { classId, subjectId } },
    });
  }

  async findCurriculumConfigsForClass(params: {
    schoolId: string;
    classId: string;
    classLevel?: string | null;
    serieCode?: string | null;
  }): Promise<{
    overrides: ClassSubjectOverrideRecord[];
    levelCoefficients: SubjectCoefficientRecord[];
  }> {
    const [overrides, levelCoefficients] = await Promise.all([
      this.prisma.classSubjectOverride.findMany({
        where: { schoolId: params.schoolId, classId: params.classId },
      }),
      params.classLevel
        ? this.prisma.subjectCoefficient.findMany({
            where: {
              schoolId: params.schoolId,
              classLevel: params.classLevel,
              ...(params.serieCode ? { OR: [{ serieCode: params.serieCode }, { serieCode: null }] } : {}),
            },
          })
        : Promise.resolve([]),
    ]);
    return { overrides, levelCoefficients };
  }

  async upsertOverride(params: {
    schoolId: string;
    classId: string;
    subjectId: string;
    coefficient: number;
    groupKey?: string | null;
    groupLabel?: string | null;
    groupOrder?: number | null;
  }): Promise<ClassSubjectOverrideRecord> {
    return this.prisma.classSubjectOverride.upsert({
      where: { classId_subjectId: { classId: params.classId, subjectId: params.subjectId } },
      create: {
        schoolId: params.schoolId,
        classId: params.classId,
        subjectId: params.subjectId,
        coefficient: params.coefficient,
        groupKey: params.groupKey ?? null,
        groupLabel: params.groupLabel ?? null,
        groupOrder: params.groupOrder ?? null,
      },
      update: {
        coefficient: params.coefficient,
        ...(params.groupKey !== undefined ? { groupKey: params.groupKey } : {}),
        ...(params.groupLabel !== undefined ? { groupLabel: params.groupLabel } : {}),
        ...(params.groupOrder !== undefined ? { groupOrder: params.groupOrder } : {}),
      },
    });
  }

  async deleteOverride(classId: string, subjectId: string): Promise<void> {
    await this.prisma.classSubjectOverride.delete({
      where: { classId_subjectId: { classId, subjectId } },
    });
  }

  async upsertCoefficient(params: {
    schoolId: string;
    subjectId: string;
    classLevel: string;
    serieCode: string | null;
    coefficient: number;
    groupKey?: string | null;
    groupLabel?: string | null;
    groupOrder?: number | null;
  }): Promise<SubjectCoefficientRecord> {
    return this.prisma.subjectCoefficient.upsert({
      where: {
        schoolId_subjectId_classLevel_serieCode: {
          schoolId: params.schoolId,
          subjectId: params.subjectId,
          classLevel: params.classLevel ?? '',
          serieCode: params.serieCode ?? '',
        },
      },
      create: {
        schoolId: params.schoolId,
        subjectId: params.subjectId,
        classLevel: params.classLevel ?? '',
        serieCode: params.serieCode,
        coefficient: params.coefficient,
        groupKey: params.groupKey ?? null,
        groupLabel: params.groupLabel ?? null,
        groupOrder: params.groupOrder ?? null,
      },
      update: {
        coefficient: params.coefficient,
        ...(params.groupKey !== undefined ? { groupKey: params.groupKey } : {}),
        ...(params.groupLabel !== undefined ? { groupLabel: params.groupLabel } : {}),
        ...(params.groupOrder !== undefined ? { groupOrder: params.groupOrder } : {}),
      },
    });
  }

  async deleteCoefficientsForSubject(params: {
    schoolId: string;
    subjectId: string;
    classLevel: string;
    serieCode: string | null;
  }): Promise<number> {
    const result = await this.prisma.subjectCoefficient.deleteMany({
      where: {
        schoolId: params.schoolId,
        subjectId: params.subjectId,
        classLevel: params.classLevel ?? undefined,
        ...(params.serieCode !== null ? { serieCode: params.serieCode } : { serieCode: null }),
      },
    });
    return result.count;
  }
}
