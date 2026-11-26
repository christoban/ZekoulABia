import type { PrismaClient } from '@prisma/client';
import type {
  ProgrammeRepository,
  ProgrammeProps,
  ProgrammeCreateData,
  ProgrammeUpdateData,
  ProgrammeFilters,
} from '@domain/ports/repositories/ProgrammeRepository';

const PROGRAMME_INCLUDE = {
  subject: { select: { id: true, name: true } },
  class: { select: { id: true, name: true } },
  chapitres: { orderBy: { ordre: 'asc' as const } },
};

export class PrismaProgrammeRepository implements ProgrammeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByFilters(schoolId: string, filters: ProgrammeFilters): Promise<ProgrammeProps[]> {
    return this.prisma.programme.findMany({
      where: {
        schoolId,
        ...(filters.academicYearId && { academicYearId: filters.academicYearId }),
        ...(filters.classId && { classId: filters.classId }),
        ...(filters.level && { level: filters.level }),
        ...(filters.subjectId && { subjectId: filters.subjectId }),
      },
      include: PROGRAMME_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdAndSchool(id: string, schoolId: string): Promise<ProgrammeProps | null> {
    return this.prisma.programme.findFirst({
      where: { id, schoolId },
      include: PROGRAMME_INCLUDE,
    });
  }

  async findByClassSubject(
    schoolId: string,
    subjectId: string,
    academicYearId: string,
    classId: string,
    level: string | null,
  ): Promise<ProgrammeProps | null> {
    const exact = await this.prisma.programme.findFirst({
      where: { schoolId, subjectId, academicYearId, classId },
      include: PROGRAMME_INCLUDE,
    });
    if (exact) return exact;

    if (!level) return null;
    return this.prisma.programme.findFirst({
      where: { schoolId, subjectId, academicYearId, level, classId: null },
      include: PROGRAMME_INCLUDE,
    });
  }

  async findBySubject(schoolId: string, subjectId: string, academicYearId: string): Promise<ProgrammeProps | null> {
    return this.prisma.programme.findFirst({
      where: { schoolId, subjectId, academicYearId, classId: null },
      include: PROGRAMME_INCLUDE,
    });
  }

  async save(data: ProgrammeCreateData): Promise<ProgrammeProps> {
    return this.prisma.programme.create({
      data: {
        schoolId: data.schoolId,
        subjectId: data.subjectId,
        classId: data.classId,
        level: data.level,
        academicYearId: data.academicYearId,
        titre: data.titre,
        ...(data.officialProgressionId !== undefined && { officialProgressionId: data.officialProgressionId }),
        ...(data.source !== undefined && { source: data.source }),
        ...(data.sourceChecksum !== undefined && { sourceChecksum: data.sourceChecksum }),
        ...(data.filiere !== undefined && { filiere: data.filiere }),
      },
      include: PROGRAMME_INCLUDE,
    });
  }

  async update(data: ProgrammeUpdateData): Promise<ProgrammeProps> {
    return this.prisma.programme.update({
      where: { id: data.id },
      data: {
        ...(data.titre !== undefined && { titre: data.titre }),
        ...(data.subjectId && { subjectId: data.subjectId }),
        ...(data.academicYearId && { academicYearId: data.academicYearId }),
        ...(data.classId !== undefined && { classId: data.classId }),
        ...(data.level !== undefined && { level: data.level }),
      },
      include: PROGRAMME_INCLUDE,
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.programme.delete({ where: { id } });
  }
}
