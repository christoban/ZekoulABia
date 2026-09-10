import type { PrismaClient } from '@prisma/client';
import type { HarmonizedAssessmentSessionRepository, SessionListItem } from '@domain/ports/repositories/HarmonizedAssessmentSessionRepository';
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

  async findByIdWithLabels(id: string, schoolId: string): Promise<SessionListItem | null> {
    const row = await this.prisma.harmonizedAssessmentSession.findFirst({
      where: { id, schoolId },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
    });
    if (!row) return null;
    return {
      id: row.id,
      schoolId: row.schoolId,
      assessmentScopeId: row.assessmentScopeId,
      subjectId: row.subjectId,
      subjectName: row.subject.name,
      classId: row.classId,
      className: row.class.name,
      academicSequenceId: row.academicSequenceId,
      scheduledDate: row.scheduledDate,
      status: row.status,
      isAnonymized: row.isAnonymized,
      anonymatStatus: row.anonymatStatus,
      correctionMode: row.correctionMode,
    };
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

  async findBySchoolWithLabels(schoolId: string, filters?: { classId?: string; subjectId?: string }): Promise<SessionListItem[]> {
    const rows = await this.prisma.harmonizedAssessmentSession.findMany({
      where: {
        schoolId,
        ...(filters?.classId ? { classId: filters.classId } : {}),
        ...(filters?.subjectId ? { subjectId: filters.subjectId } : {}),
      },
      include: {
        class: { select: { id: true, name: true } },
        subject: { select: { id: true, name: true } },
      },
      orderBy: { scheduledDate: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      schoolId: r.schoolId,
      assessmentScopeId: r.assessmentScopeId,
      subjectId: r.subjectId,
      subjectName: r.subject.name,
      classId: r.classId,
      className: r.class.name,
      academicSequenceId: r.academicSequenceId,
      scheduledDate: r.scheduledDate,
      status: r.status,
      isAnonymized: r.isAnonymized,
      anonymatStatus: r.anonymatStatus,
      correctionMode: r.correctionMode,
    }));
  }
}
