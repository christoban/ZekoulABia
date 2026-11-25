import type { HarmonizedAssessmentSession } from '@domain/entities/HarmonizedAssessmentSession';

export type SessionListItem = {
  id: string;
  schoolId: string;
  assessmentScopeId: string;
  subjectId: string;
  subjectName: string;
  classId: string;
  className: string;
  academicSequenceId: string | null;
  scheduledDate: Date;
  status: string;
  isAnonymized: boolean;
  anonymatStatus: string;
  correctionMode: string | null;
};

export interface HarmonizedAssessmentSessionRepository {
  findById(id: string, schoolId: string): Promise<HarmonizedAssessmentSession | null>;
  findByIdWithLabels(id: string, schoolId: string): Promise<SessionListItem | null>;
  findBySubjectClassAndYear(schoolId: string, subjectId: string, classId: string, academicYearId: string): Promise<HarmonizedAssessmentSession[]>;
  findBySchool(schoolId: string, filters?: { classId?: string; subjectId?: string }): Promise<HarmonizedAssessmentSession[]>;
  findBySchoolWithLabels(schoolId: string, filters?: { classId?: string; subjectId?: string }): Promise<SessionListItem[]>;
  save(session: HarmonizedAssessmentSession): Promise<void>;
  update(session: HarmonizedAssessmentSession): Promise<void>;
  delete(id: string, schoolId: string): Promise<void>;
  findUpcoming(schoolId: string): Promise<HarmonizedAssessmentSession[]>;
}