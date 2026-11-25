import type { PrismaClient } from '@prisma/client';
import type {
  ProgrammeRepository,
  ProgrammeProps,
  ProgrammeCreateData,
  ProgrammeUpdateData,
  ProgrammeFilters,
} from '@domain/ports/repositories/ProgrammeRepository';

export class PrismaProgrammeRepository implements ProgrammeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByFilters(schoolId: string, filters: ProgrammeFilters): Promise<ProgrammeProps[]> {
    return this.prisma.programme.findMany({
      where: { schoolId, ...(filters.academicYearId && { academicYearId: filters.academicYearId }), ...(filters.classId && { classId: filters.classId }), ...(filters.level && { level: filters.level }), ...(filters.subjectId && { subjectId: filters.subjectId }) },
      include: {
        subject: { select: { id: true, name: true } },
        class: { select: { id: true, name: true } },
        chapitres: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByIdAndSchool(id: string, schoolId: string): Promise<ProgrammeProps | null> {
    return this.prisma.programme.findFirst({
      where: { id, schoolId },
      include: { subject: { select: { id: true, name: true } }, class: { select: { id: true, name: true } }, chapitres: true },
    });
  }

  async findByClassSubject(schoolId: string, subjectId: string, academicYearId: string, classId: string, level: string | null): Promise<ProgrammeProps | null> {
    return this.prisma.programme.findFirst({
      where: { schoolId, subjectId, academicYearId, OR: [{ classId }, { level, classId: null }] },
      include: { subject: { select: { id: true, name: true } }, class: { select: { id: true, name: true } }, chapitres: true },
    });
  }

  async findBySubject(schoolId: string, subjectId: string, academicYearId: string): Promise<ProgrammeProps | null> {
    return this.prisma.programme.findFirst({
      where: { schoolId, subjectId, academicYearId, classId: null },
      include: { subject: { select: { id: true, name: true } }, class: { select: { id: true, name: true } }, chapitres: true },
    });
  }

  async save(data: ProgrammeCreateData): Promise<ProgrammeProps> {
    return this.prisma.programme.create({
      data: { schoolId: data.schoolId, subjectId: data.subjectId, classId: data.classId, level: data.level, academicYearId: data.academicYearId, titre: data.titre },
      include: { subject: { select: { id: true, name: true } }, class: { select: { id: true, name: true } }, chapitres: true },
    });
  }

  async update(data: ProgrammeUpdateData): Promise<ProgrammeProps> {
    return this.prisma.programme.update({
      where: { id: data.id },
      data: { ...(data.titre !== undefined && { titre: data.titre }), ...(data.subjectId && { subjectId: data.subjectId }), ...(data.academicYearId && { academicYearId: data.academicYearId }), ...(data.classId !== undefined && { classId: data.classId }), ...(data.level !== undefined && { level: data.level }) },
      include: { subject: { select: { id: true, name: true } }, class: { select: { id: true, name: true } }, chapitres: true },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.programme.delete({ where: { id } });
  }
}
