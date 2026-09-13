/**
 * DOMAIN LAYER — Port Repository Dashboard (statistiques agrégées multi-rôles)
 */
export interface DashboardCounts {
  totalStudents: number;
  totalTeachers: number;
  activeExams: number;
  presentAttendance: number;
  totalAttendance: number;
}

export interface TeacherSlots {
  myClasses: { id: string; name: string }[];
  todaySlots: Array<{ subjectName: string | null; className: string | null }>;
}

export interface StudentDashboard {
  presenceCount: number;
  totalPresence: number;
  recentGrades: number[];
}

export interface AdminBadges {
  users: number;
  classes: number;
  pendingGrades: number;
  pendingInvoices: number;
}

export interface DashboardQueryRepository {
  findRecentActivities(schoolId: string, userId: string, isAdmin: boolean, take: number): Promise<Array<{ action: string; createdAt: Date }>>;
  countAdminStats(schoolId: string): Promise<DashboardCounts>;
  countAdminBadges(schoolId: string): Promise<AdminBadges>;
  findTeacherDashboard(schoolId: string, teacherId: string): Promise<TeacherSlots>;
  findStudentDashboard(studentId: string): Promise<StudentDashboard>;
}
