import type { AssessmentParticipation } from '@domain/entities/AssessmentParticipation';
import type { AttendanceStatus } from '@domain/types/enums';

export interface AssessmentParticipationRepository {
  findBySession(schoolId: string, sessionId: string): Promise<AssessmentParticipation[]>;
  findByStudent(schoolId: string, studentId: string): Promise<AssessmentParticipation[]>;
  findBySessionAndStudent(schoolId: string, sessionId: string, studentId: string): Promise<AssessmentParticipation | null>;
  save(participation: AssessmentParticipation): Promise<void>;
  updateStatus(schoolId: string, sessionId: string, studentId: string, status: AttendanceStatus, recordedById: string): Promise<void>;
  countAbsentBySession(schoolId: string, sessionId: string): Promise<number>;
}