import type { PrismaClient, AssessmentParticipation as AssessmentParticipationModel } from '@prisma/client';
import type { AssessmentParticipationRepository } from '@domain/ports/repositories/AssessmentParticipationRepository';
import type { AttendanceStatus } from '@domain/types/enums';
import { AssessmentParticipation } from '@domain/entities/AssessmentParticipation';

function toDomain(data: AssessmentParticipationModel): AssessmentParticipation {
  return AssessmentParticipation.reconstituer({
    id: data.id,
    schoolId: data.schoolId,
    harmonizedAssessmentSessionId: data.harmonizedAssessmentSessionId,
    studentId: data.studentId,
    status: data.status,
    recordedById: data.recordedById,
    createdAt: data.createdAt,
  });
}

export class PrismaAssessmentParticipationRepository implements AssessmentParticipationRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findBySession(schoolId: string, sessionId: string): Promise<AssessmentParticipation[]> {
    const data = await this.prisma.assessmentParticipation.findMany({
      where: { schoolId, harmonizedAssessmentSessionId: sessionId },
    });
    return data.map(toDomain);
  }

  async findByStudent(schoolId: string, studentId: string): Promise<AssessmentParticipation[]> {
    const data = await this.prisma.assessmentParticipation.findMany({
      where: { schoolId, studentId },
    });
    return data.map(toDomain);
  }

  async findBySessionAndStudent(schoolId: string, sessionId: string, studentId: string): Promise<AssessmentParticipation | null> {
    const data = await this.prisma.assessmentParticipation.findFirst({
      where: { schoolId, harmonizedAssessmentSessionId: sessionId, studentId },
    });
    return data ? toDomain(data) : null;
  }

  async save(participation: AssessmentParticipation): Promise<void> {
    const obj = participation.toObject();
    await this.prisma.assessmentParticipation.create({
      data: {
        id: obj.id,
        schoolId: obj.schoolId,
        harmonizedAssessmentSessionId: obj.harmonizedAssessmentSessionId,
        studentId: obj.studentId,
        status: obj.status,
        recordedById: obj.recordedById,
      },
    });
  }

  async updateStatus(schoolId: string, sessionId: string, studentId: string, status: AttendanceStatus, recordedById: string): Promise<void> {
    await this.prisma.assessmentParticipation.updateMany({
      where: {
        schoolId,
        harmonizedAssessmentSessionId: sessionId,
        studentId,
      },
      data: { status, recordedById },
    });
  }

  async countAbsentBySession(schoolId: string, sessionId: string): Promise<number> {
    return this.prisma.assessmentParticipation.count({
      where: {
        schoolId,
        harmonizedAssessmentSessionId: sessionId,
        status: 'ABSENT',
      },
    });
  }
}