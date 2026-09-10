import type { HarmonizedAssessmentSession } from '@domain/entities/HarmonizedAssessmentSession';

export interface HarmonizedAssessmentSessionRepository {
  findById(id: string, schoolId: string): Promise<HarmonizedAssessmentSession | null>;
  findBySubjectClassAndYear(schoolId: string, subjectId: string, classId: string, academicYearId: string): Promise<HarmonizedAssessmentSession[]>;
  findBySchool(schoolId: string, filters?: { classId?: string; subjectId?: string }): Promise<HarmonizedAssessmentSession[]>;
  save(session: HarmonizedAssessmentSession): Promise<void>;
  update(session: HarmonizedAssessmentSession): Promise<void>;
  delete(id: string, schoolId: string): Promise<void>;
  findUpcoming(schoolId: string): Promise<HarmonizedAssessmentSession[]>;
}