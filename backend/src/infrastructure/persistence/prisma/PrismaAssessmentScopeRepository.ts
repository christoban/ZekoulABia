import type { PrismaClient } from '@prisma/client';
import type { AssessmentScopeRepository } from '@domain/ports/repositories/AssessmentScopeRepository';
import { AssessmentScope } from '@domain/entities/AssessmentScope';
import type { SequenceType } from '@domain/types/enums';

export class PrismaAssessmentScopeRepository implements AssessmentScopeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string, schoolId: string): Promise<AssessmentScope | null> {
    const data = await this.prisma.assessmentScope.findFirst({
      where: { id, schoolId },
    });
    if (!data) return null;
    return AssessmentScope.reconstituer({
      id: data.id,
      schoolId: data.schoolId,
      academicYearId: data.academicYearId,
      name: data.name,
      sequenceType: data.sequenceType as SequenceType,
      subjectIds: data.subjectIds,
      classIds: data.classIds,
      createdAt: data.createdAt,
    });
  }

  async findBySchoolAndYear(schoolId: string, academicYearId: string): Promise<AssessmentScope[]> {
    const data = await this.prisma.assessmentScope.findMany({
      where: { schoolId, academicYearId },
    });
    return data.map((d) =>
      AssessmentScope.reconstituer({
        id: d.id,
        schoolId: d.schoolId,
        academicYearId: d.academicYearId,
        name: d.name,
        sequenceType: d.sequenceType as SequenceType,
        subjectIds: d.subjectIds,
        classIds: d.classIds,
        createdAt: d.createdAt,
      })
    );
  }

  async save(scope: AssessmentScope): Promise<void> {
    const obj = scope.toObject();
    await this.prisma.assessmentScope.create({
      data: {
        id: obj.id,
        schoolId: obj.schoolId,
        academicYearId: obj.academicYearId,
        name: obj.name,
        sequenceType: obj.sequenceType,
        subjectIds: obj.subjectIds,
        classIds: obj.classIds,
      },
    });
  }

  async update(scope: AssessmentScope): Promise<void> {
    const obj = scope.toObject();
    await this.prisma.assessmentScope.update({
      where: { id: obj.id },
      data: {
        name: obj.name,
        sequenceType: obj.sequenceType,
        subjectIds: obj.subjectIds,
        classIds: obj.classIds,
      },
    });
  }

  async delete(id: string, schoolId: string): Promise<void> {
    await this.prisma.assessmentScope.deleteMany({ where: { id, schoolId } });
  }
}