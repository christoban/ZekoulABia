import type { PrismaClient, TeacherUnavailability as PrismaTeacherUnavailability } from '@prisma/client';
import { TeacherUnavailability } from '@domain/entities/TeacherUnavailability';
import type { TeacherUnavailabilityRepository } from '@domain/ports/repositories/TeacherUnavailabilityRepository';

export class PrismaTeacherUnavailabilityRepository implements TeacherUnavailabilityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<TeacherUnavailability | null> {
    const data = await this.prisma.teacherUnavailability.findUnique({ where: { id } });
    if (!data) return null;
    return TeacherUnavailability.reconstituer(this.toProps(data));
  }

  async findBySchool(schoolId: string, includeInactive?: boolean): Promise<TeacherUnavailability[]> {
    const data = await this.prisma.teacherUnavailability.findMany({
      where: { schoolId, ...(includeInactive ? {} : { active: true }) },
      orderBy: [{ teacherId: 'asc' }, { dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return data.map(d => TeacherUnavailability.reconstituer(this.toProps(d)));
  }

  async findByTeacher(teacherId: string, schoolId: string, activeOnly?: boolean): Promise<TeacherUnavailability[]> {
    const data = await this.prisma.teacherUnavailability.findMany({
      where: { teacherId, schoolId, ...(activeOnly ? { active: true } : {}) },
      orderBy: { startTime: 'asc' },
    });
    return data.map(d => TeacherUnavailability.reconstituer(this.toProps(d)));
  }

  async save(indisponibilite: TeacherUnavailability): Promise<void> {
    const d = indisponibilite.toObject();
    await this.prisma.teacherUnavailability.create({
      data: {
        id: d.id,
        schoolId: d.schoolId,
        teacherId: d.teacherId,
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        reason: d.reason,
        active: d.active,
        createdAt: d.createdAt,
      },
    });
  }

  async update(indisponibilite: TeacherUnavailability): Promise<void> {
    const d = indisponibilite.toObject();
    await this.prisma.teacherUnavailability.update({
      where: { id: d.id },
      data: {
        dayOfWeek: d.dayOfWeek,
        startTime: d.startTime,
        endTime: d.endTime,
        reason: d.reason,
        active: d.active,
      },
    });
  }

  async delete(id: string, schoolId: string): Promise<void> {
    await this.prisma.teacherUnavailability.deleteMany({ where: { id, schoolId } });
  }

  private toProps(data: PrismaTeacherUnavailability): {
    id: string; schoolId: string; teacherId: string; dayOfWeek: number;
    startTime: string; endTime: string; reason: string | null; active: boolean; createdAt: Date;
  } {
    return {
      id: data.id,
      schoolId: data.schoolId,
      teacherId: data.teacherId,
      dayOfWeek: data.dayOfWeek,
      startTime: data.startTime,
      endTime: data.endTime,
      reason: data.reason,
      active: data.active,
      createdAt: data.createdAt,
    };
  }
}