export interface ExamUpcoming {
  id: string;
  subjectId: string;
  classId: string;
}

export interface ExamRepository {
  /** Examens à venir (scheduledAt >= now) pour une école et une liste de matières. */
  findUpcomingBySubjects(schoolId: string, subjectIds: string[]): Promise<ExamUpcoming[]>;
  /** Alias legacy — tous les examens d'une école (utilisé par la spec academic.ts). */
  findBySchool(schoolId: string): Promise<ExamUpcoming[]>;
  /** Un examen par id (academicYearId/scheduledAt/duration requis pour la session harmonisée — spec academic.ts). */
  findById(id: string): Promise<{ id: string; academicYearId: string; scheduledAt: Date | null; duration: number | null } | null>;
}
