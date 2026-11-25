import type { PrismaClient, SchoolConfig } from '@prisma/client';
import type {
  SchoolConfigData,
  SchoolConfigRepository,
  UpsertBulletinConfigInput,
} from '@domain/ports/repositories/SchoolConfigRepository';

export class PrismaSchoolConfigRepository implements SchoolConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySchool(schoolId: string): Promise<SchoolConfig | null> {
    return this.prisma.schoolConfig.findUnique({ where: { schoolId } });
  }

  async findBySchoolId(schoolId: string): Promise<SchoolConfig | null> {
    return this.prisma.schoolConfig.findUnique({ where: { schoolId } });
  }

  async upsertBulletinConfig(schoolId: string, input: UpsertBulletinConfigInput): Promise<SchoolConfigData> {
    return this.prisma.schoolConfig.upsert({
      where: { schoolId },
      create: {
        schoolId,
        ...(input.bulletinTemplate !== undefined ? { bulletinTemplate: input.bulletinTemplate } : {}),
        ...(input.bulletinGroupingScheme !== undefined ? { bulletinGroupingScheme: input.bulletinGroupingScheme } : {}),
        ...(input.useMeasuredBulletinRenderer !== undefined
          ? { useMeasuredBulletinRenderer: input.useMeasuredBulletinRenderer }
          : {}),
      },
      update: {
        ...(input.bulletinTemplate !== undefined ? { bulletinTemplate: input.bulletinTemplate } : {}),
        ...(input.bulletinGroupingScheme !== undefined ? { bulletinGroupingScheme: input.bulletinGroupingScheme } : {}),
        ...(input.useMeasuredBulletinRenderer !== undefined
          ? { useMeasuredBulletinRenderer: input.useMeasuredBulletinRenderer }
          : {}),
      },
    });
  }
}