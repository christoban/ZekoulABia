import type { AssessmentScope } from '@domain/entities/AssessmentScope';

export interface AssessmentScopeRepository {
  findById(id: string, schoolId: string): Promise<AssessmentScope | null>;
  findBySchoolAndYear(schoolId: string, academicYearId: string): Promise<AssessmentScope[]>;
  save(scope: AssessmentScope): Promise<void>;
  update(scope: AssessmentScope): Promise<void>;
  delete(id: string, schoolId: string): Promise<void>;
}