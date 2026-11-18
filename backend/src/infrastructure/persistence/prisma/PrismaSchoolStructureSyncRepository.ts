import type { PrismaClient, Prisma } from '@prisma/client';
import type {
  SchoolStructureSyncRepository,
  SchoolTemplateAndConfig,
  SchoolSyncClassRecord,
  SchoolSubjectSummary,
} from '@domain/ports/repositories/SchoolStructureSyncRepository';

export class PrismaSchoolStructureSyncRepository implements SchoolStructureSyncRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findSchoolTemplateAndConfig(schoolId: string): Promise<SchoolTemplateAndConfig | null> {
    return this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { onboardingConfig: true, templateCode: true },
    });
  }

  async findCurrentAcademicYearId(schoolId: string): Promise<string | null> {
    const year = await this.prisma.academicYear.findFirst({
      where: { schoolId, isCurrent: true },
      select: { id: true },
    });
    return year?.id ?? null;
  }

  async updateOnboardingConfig(schoolId: string, onboardingConfig: Record<string, unknown>): Promise<void> {
    await this.prisma.school.update({
      where: { id: schoolId },
      data: { onboardingConfig: onboardingConfig as Prisma.InputJsonValue },
    });
  }

  async findClassesForSync(schoolId: string): Promise<SchoolSyncClassRecord[]> {
    return this.prisma.class.findMany({
      where: { schoolId },
      select: { id: true, name: true, level: true, serie: true, filiere: true },
      orderBy: { name: 'asc' },
    });
  }

  async findExistingClassNames(schoolId: string): Promise<string[]> {
    const existing = await this.prisma.class.findMany({
      where: { schoolId },
      select: { name: true },
    });
    return existing.map((c) => c.name);
  }

  async createClass(input: {
    schoolId: string;
    academicYearId: string;
    name: string;
    level: string;
  }): Promise<void> {
    await this.prisma.class.create({
      data: {
        schoolId: input.schoolId,
        academicYearId: input.academicYearId,
        name: input.name,
        level: input.level,
      },
    });
  }

  async updateClassSerie(classId: string, serie: string | null): Promise<void> {
    await this.prisma.class.update({
      where: { id: classId },
      data: { serie },
    });
  }

  async findSubjectsSummary(schoolId: string): Promise<SchoolSubjectSummary[]> {
    return this.prisma.subject.findMany({
      where: { schoolId },
      select: { id: true, name: true },
    });
  }

  async countSubjectCoefficients(
    schoolId: string,
    filter?: { classLevel?: string; serieCode?: string | null },
  ): Promise<number> {
    return this.prisma.subjectCoefficient.count({
      where: {
        schoolId,
        ...(filter?.classLevel !== undefined ? { classLevel: filter.classLevel } : {}),
        ...(filter && 'serieCode' in filter ? { serieCode: filter.serieCode ?? null } : {}),
      },
    });
  }

  async countDepartments(schoolId: string): Promise<number> {
    return this.prisma.department.count({ where: { schoolId } });
  }

  async createDepartment(schoolId: string, name: string, color: string): Promise<{ id: string; name: string }> {
    const dept = await this.prisma.department.create({
      data: { schoolId, name, color },
    });
    return { id: dept.id, name: dept.name };
  }

  async assignSubjectDepartment(subjectId: string, departmentId: string): Promise<void> {
    await this.prisma.subject.update({
      where: { id: subjectId },
      data: { departmentId },
    });
  }
}
