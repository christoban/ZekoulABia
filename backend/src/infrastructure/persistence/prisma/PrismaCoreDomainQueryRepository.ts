import type { PrismaClient, Prisma } from '@prisma/client';
import type { PeriodType } from '@domain/types/enums';
import type {
  CoreDomainAcademicYear,
  CoreDomainPeriod,
  CoreDomainPeriodInput,
  CoreDomainQueryRepository,
} from '@domain/ports/repositories/CoreDomainQueryRepository';

export class PrismaCoreDomainQueryRepository implements CoreDomainQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAcademicYear(id: string, schoolId: string): Promise<CoreDomainAcademicYear | null> {
    return this.prisma.academicYear.findFirst({ where: { id, schoolId } });
  }

  async countPeriods(academicYearId: string): Promise<number> {
    return this.prisma.academicPeriod.count({ where: { academicYearId } });
  }

  async createPeriod(input: CoreDomainPeriodInput): Promise<CoreDomainPeriod> {
    return this.prisma.academicPeriod.create({ data: { ...input } });
  }

  async findPeriods(params: { academicYearId?: string; type?: PeriodType; schoolId: string }): Promise<CoreDomainPeriod[]> {
    const { academicYearId, type, schoolId } = params;
    return this.prisma.academicPeriod.findMany({
      where: {
        ...(academicYearId ? { academicYearId } : {}),
        ...(type ? { type } : {}),
        academicYear: { schoolId },
      },
      include: { academicYear: true },
      orderBy: { startDate: 'asc' },
    });
  }

  async findPeriodById(id: string, schoolId: string): Promise<CoreDomainPeriod | null> {
    return this.prisma.academicPeriod.findFirst({ where: { id, academicYear: { schoolId } } });
  }

  async updatePeriod(id: string, data: Record<string, unknown>): Promise<CoreDomainPeriod> {
    return this.prisma.academicPeriod.update({ where: { id }, data: data as Prisma.AcademicPeriodUpdateInput });
  }
}
