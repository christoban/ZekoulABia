/**
 * DOMAIN LAYER — Port Repository TeachingAssignment (rattachements enseignants)
 */
export interface TeachingAssignmentData {
  id: string;
  classId: string;
  subjectId: string;
  teacherId: string;
  schoolId: string;
  academicYearId: string;
}

export interface TeachingAssignmentRepository {
  findByClassSubjectAndSchool(classId: string, subjectId: string, schoolId: string): Promise<TeachingAssignmentData | null>;
  findUnique(classId: string, subjectId: string, schoolId?: string): Promise<TeachingAssignmentData | null>;
}
