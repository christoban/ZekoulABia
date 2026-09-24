import type { Request, Response, NextFunction } from 'express';
import type { DashboardQueryRepository } from '@domain/ports/repositories/DashboardQueryRepository';
import type { EnrollmentRepository } from '@domain/ports/repositories/EnrollmentRepository';
import { getClasseActuelleEleve } from '@application/shared/studentEnrollment';

const formatPercent = (n: number, d: number) =>
  d ? `${Math.round((n / d) * 100)}%` : '0%';

export class DashboardController {
  constructor(
    private readonly dashboardRepo: DashboardQueryRepository,
    private readonly enrollmentRepository: EnrollmentRepository,
  ) {}

  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user!;
      const schoolId = user.schoolId;

      const recentActivities = await this.dashboardRepo.findRecentActivities(schoolId, user.userId, user.role === 'ADMIN', 5);
      const formattedActivity = recentActivities.map(
        (log) => `${log.action} (${new Date(log.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
      );

      let stats: any = {};

      if (user.role === 'ADMIN') {
        const counts = await this.dashboardRepo.countAdminStats(schoolId);
        stats = { totalStudents: counts.totalStudents, totalTeachers: counts.totalTeachers, activeExams: counts.activeExams ?? 0, avgAttendance: formatPercent(counts.presentAttendance, counts.totalAttendance), pendingTeachingIssues: counts.pendingTeachingIssues, recentActivity: formattedActivity };

      } else if (user.role === 'TEACHER') {
        const teacherDash = await this.dashboardRepo.findTeacherDashboard(schoolId, user.userId);
        const nextClass = teacherDash.todaySlots[0]
          ? `${teacherDash.todaySlots[0].subjectName} - ${teacherDash.todaySlots[0].className}`
          : 'Aucun cours aujourd\'hui';

        stats = { myClassesCount: teacherDash.myClasses.length, myClassNames: teacherDash.myClasses.map((c) => c.name), nextClass, recentActivity: formattedActivity };

      } else if (user.role === 'STUDENT') {
        const classeActuelle = await getClasseActuelleEleve(this.enrollmentRepository, user.userId);
        const data = await this.dashboardRepo.findStudentDashboard(user.userId);
        // ponytail: simple avg, stdlib 1-liner — centralize when weighted coeffs diverge
        const avgGrade = data.recentGrades.length ? (data.recentGrades.reduce((s, g) => s + g, 0) / data.recentGrades.length).toFixed(1) : 'N/A';
        stats = { className: classeActuelle?.className || 'Non assigné', avgAttendance: formatPercent(data.presenceCount, data.totalPresence), avgGrade, recentActivity: formattedActivity };

      } else if (user.role === 'PARENT') {
        stats = { recentActivity: formattedActivity };
      }

      res.json({ stats });
    } catch (error) {
      next(error);
    }
  };

  getAdminBadges = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { schoolId } = req.user!;
      const badges = await this.dashboardRepo.countAdminBadges(schoolId);
      res.json({ success: true, data: badges });
    } catch (error) {
      next(error);
    }
  };
}
