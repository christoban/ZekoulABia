/**
 * DOMAIN LAYER — Port Repository TeacherUnavailability (V2.4)
 */
import type { TeacherUnavailability } from '@domain/entities/TeacherUnavailability';

export interface TeacherUnavailabilityRepository {
  findById(id: string): Promise<TeacherUnavailability | null>;
  findBySchool(schoolId: string, includeInactive?: boolean): Promise<TeacherUnavailability[]>;
  findByTeacher(teacherId: string, schoolId: string, activeOnly?: boolean): Promise<TeacherUnavailability[]>;
  save(indisponibilite: TeacherUnavailability): Promise<void>;
  update(indisponibilite: TeacherUnavailability): Promise<void>;
  delete(id: string, schoolId: string): Promise<void>;
}
