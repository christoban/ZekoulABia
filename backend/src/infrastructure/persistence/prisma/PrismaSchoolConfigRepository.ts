import type { PrismaClient, SchoolConfig } from '@prisma/client';
import type { SchoolConfigRepository } from '@domain/ports/repositories/SchoolConfigRepository';

export class PrismaSchoolConfigRepository implements SchoolConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySchool(schoolId: string): Promise<SchoolConfig | null> {
    return this.prisma.schoolConfig.findUnique({ where: { schoolId } });
  }

  async findBySchoolId(schoolId: string): Promise<SchoolConfig | null> {
    return this.prisma.schoolConfig.findUnique({ where: { schoolId } });
  }
}