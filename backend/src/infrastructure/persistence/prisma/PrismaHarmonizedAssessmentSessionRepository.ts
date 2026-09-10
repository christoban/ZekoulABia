import type { PrismaClient } from '@prisma/client';
import type { HarmonizedAssessmentSessionRepository } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
import { HarmonizedAssessmentSession } from '@domain/entities/HarmonizedAssessmentSession';

function toDomain(data: any): HarmonizedAssessmentSession {
  return HarmonizedAssessmentSession.reconstituer({
    id: data.id,
    schoolId: data.schoolId,
    assessmentScopeId: data.assessmentScopeId,
    subjectId: data.subjectId,
    classId: data.classId,
    academicSequenceId: data.academicSequenceId,
    scheduledDate: data.scheduledDate,
    durationMinutes: data.durationMinutes,
    status: data.status,
    createdAt: data.createdAt,
    isAnonymized: data.isAnonymized ?? false,
    anonymatStatus: data.anonymatStatus ?? 'NONE',
    correctionMode: data.correctionMode ?? null,
    codesGeneratedAt: data.codesGeneratedAt ?? null,
    codesGeneratedById: data.codesGeneratedById ?? null,
    reconciledAt: data.reconciledAt ?? null,
    reconciledById: data.reconciledById ?? null,
  });
}

export class PrismaHarmonizedAssessmentSessionRepository implements HarmonizedAssessmentSessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, schoolId: string): Promise<HarmonizedAssessmentSession | null> {
    const data = await this.prisma.harmonizedAssessmentSession.findFirst({ where: { id, schoolId } });
    return data ? toDomain(data) : null;
  }

  async findBySubjectClassAndYear(schoolId: string, subjectId: string, classId: string, academicYearId: string): Promise<HarmonizedAssessmentSession[]> {
    const data = await this.prisma.harmonizedAssessmentSession.findMany({
      where: {
        schoolId,
        subjectId,
        classId,
        assessmentScope: { academicYearId },
      },
      include: { assessmentScope: true },
    });
    return data.map(toDomain);
  }

  async save(session: HarmonizedAssessmentSession): Promise<void> {
    const obj = session.toObject();
    await this.prisma.harmonizedAssessmentSession.create({
      data: {
        id: obj.id,
        schoolId: obj.schoolId,
        assessmentScopeId: obj.assessmentScopeId,
        subjectId: obj.subjectId,
        classId: obj.classId,
        academicSequenceId: obj.academicSequenceId,
        scheduledDate: obj.scheduledDate,
        durationMinutes: obj.durationMinutes,
        status: obj.status,
        isAnonymized: obj.isAnonymized,
        anonymatStatus: obj.anonymatStatus,
        correctionMode: obj.correctionMode,
        codesGeneratedAt: obj.codesGeneratedAt,
        codesGeneratedById: obj.codesGeneratedById,
        reconciledAt: obj.reconciledAt,
        reconciledById: obj.reconciledById,
      },
    });
  }

  async update(session: HarmonizedAssessmentSession): Promise<void> {
    const obj = session.toObject();
    await this.prisma.harmonizedAssessmentSession.update({
      where: { id: obj.id },
      data: {
        status: obj.status,
        scheduledDate: obj.scheduledDate,
        durationMinutes: obj.durationMinutes,
        academicSequenceId: obj.academicSequenceId,
        isAnonymized: obj.isAnonymized,
        anonymatStatus: obj.anonymatStatus,
        correctionMode: obj.correctionMode,
        codesGeneratedAt: obj.codesGeneratedAt,
        codesGeneratedById: obj.codesGeneratedById,
        reconciledAt: obj.reconciledAt,
        reconciledById: obj.reconciledById,
      },
    });
  }

  async delete(id: string, schoolId: string): Promise<void> {
    await this.prisma.harmonizedAssessmentSession.deleteMany({ where: { id, schoolId } });
  }

  async findUpcoming(schoolId: string): Promise<HarmonizedAssessmentSession[]> {
    const data = await this.prisma.harmonizedAssessmentSession.findMany({
      where: {
        schoolId,
        status: { in: ['PLANNED', 'IN_PROGRESS'] },
        scheduledDate: { gte: new Date() },
      },
      orderBy: { scheduledDate: 'asc' },
    });
    return data.map(toDomain);
  }

  async findBySchool(schoolId: string, filters?: { classId?: string; subjectId?: string }): Promise<HarmonizedAssessmentSession[]> {
    const data = await this.prisma.harmonizedAssessmentSession.findMany({
      where: {
        schoolId,
        classId: filters?.classId,
        subjectId: filters?.subjectId,
      },
      orderBy: { scheduledDate: 'desc' },
    });
    return data.map(toDomain);
  }
}
