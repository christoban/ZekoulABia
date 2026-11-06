/**
 * DOMAIN LAYER — Port Repository StudentRecommendation
 * Gestion des recommandations élèves (alertes santé, chutes de moyenne, etc.)
 */
export interface StudentRecommendationData {
  id: string;
  schoolId: string;
  studentId: string;
  subjectId: string | null;
  recipientRole: string; // 'STUDENT' | 'PARENT' | 'TEACHER'
  contextType: string; // 'HEALTH_CRITICAL' | 'HEALTH_WARNING' | 'HEALTH_POSITIVE' | 'SUBJECT_DROP'
  content: string;
  createdAt: Date;
}

export interface StudentRecommendationRepository {
  create(data: Omit<StudentRecommendationData, 'id' | 'createdAt'>): Promise<StudentRecommendationData>;
  findById(id: string, schoolId: string): Promise<StudentRecommendationData | null>;
  findByStudent(studentId: string, schoolId: string): Promise<StudentRecommendationData[]>;
  findByStudentAndSubject(studentId: string, subjectId: string, schoolId: string): Promise<StudentRecommendationData | null>;
}
