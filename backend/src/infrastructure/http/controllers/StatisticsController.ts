import type { Request, Response, NextFunction } from 'express';
import type { StatisticsQueryRepository } from '@domain/ports/repositories/StatisticsQueryRepository';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import type { GetMetricUseCase } from '@application/reporting/GetMetricUseCase';

const GRADE_STATUSES_VALIDES = ['LOCKED'] as const;

export class StatisticsController {
  constructor(
    private readonly statRepo: StatisticsQueryRepository,
    private readonly audit: AIActionAuditPort,
    private readonly getMetric?: GetMetricUseCase,
  ) {}

  // GET /grades-evolution?classId=&subjectId=&studentId= — moyenne par séquence de l'année en cours
  gradesEvolution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { classId, subjectId, studentId } = req.query as {
        classId?: string; subjectId?: string; studentId?: string;
      };

      const annee = await this.statRepo.findCurrentAcademicYear(user.schoolId);
      if (!annee) {
        res.json({ success: true, data: [] });
        return;
      }

      const grades = await this.statRepo.findGradesEvolution(user.schoolId, annee.id, {
        classId, subjectId, studentId,
      });

      const index = new Map<string, { name: string; orderIndex: number; periodName: string; values: number[] }>();
      for (const g of grades) {
        if (g.sequenceAverage === null) continue;
        const key = g.sequence.id;
        if (!index.has(key)) {
          index.set(key, {
            name: g.sequence.name,
            orderIndex: g.sequence.orderIndex,
            periodName: g.sequence.academicPeriod.name,
            values: [],
          });
        }
        index.get(key)!.values.push(g.sequenceAverage);
      }

      const data = Array.from(index.values())
        .map((s) => ({
          sequenceName: s.name,
          periodName: s.periodName,
          orderIndex: s.orderIndex,
          // ponytail: simple avg, stdlib 1-liner — centralize when weighted coeffs diverge
          moyenne: Math.round((s.values.reduce((a, b) => a + b, 0) / s.values.length) * 100) / 100,
          nbNotes: s.values.length,
        }))
        .sort((a, b) => a.orderIndex - b.orderIndex);

      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'evolution_moyenne_generale', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { classId, subjectId, studentId },
      });
      res.json({ success: true, data });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'evolution_moyenne_generale', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.query,
      });
      next(error);
    }
  };

  // GET /classes-comparison?level= — moyenne générale par classe (année en cours)
  classesComparison = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const { level } = req.query as { level?: string };

      const annee = await this.statRepo.findCurrentAcademicYear(user.schoolId);
      if (!annee) {
        res.json({ success: true, data: [] });
        return;
      }

      const classes = await this.statRepo.findClassesByLevel(user.schoolId, level);
      if (classes.length === 0) {
        res.json({ success: true, data: [] });
        return;
      }

      const grades = await this.statRepo.findGradesForClassComparison(
        user.schoolId, annee.id, classes.map((c) => c.id)
      );

      const index = new Map<string, { values: number[]; students: Set<string> }>();
      for (const g of grades) {
        if (!index.has(g.classId)) index.set(g.classId, { values: [], students: new Set() });
        const entry = index.get(g.classId)!;
        if (g.sequenceAverage !== null) entry.values.push(g.sequenceAverage);
        entry.students.add(g.studentId);
      }

      const data = classes.map((c) => {
        const entry = index.get(c.id);
        // ponytail: simple avg, stdlib 1-liner — centralize when weighted coeffs diverge
        const moyenne = entry && entry.values.length > 0
          ? Math.round((entry.values.reduce((a, b) => a + b, 0) / entry.values.length) * 100) / 100
          : null;
        return {
          classId: c.id,
          className: c.name,
          level: c.level,
          moyenne,
          nbEleves: entry?.students.size ?? 0,
        };
      });

      this.audit.journaliser({
        actorUserId: user.userId, actorRole: user.role, schoolId: user.schoolId,
        actionName: 'classement_classes', origin: 'UI_DIRECT', outcome: 'SUCCES',
        parametersSummary: { level },
      });
      res.json({ success: true, data });
    } catch (error) {
      const user = req.user;
      this.audit.journaliser({
        actorUserId: user?.userId, actorRole: user?.role, schoolId: user?.schoolId,
        actionName: 'classement_classes', origin: 'UI_DIRECT', outcome: 'ERREUR',
        refusalReason: error instanceof Error ? error.message : undefined, parametersSummary: req.query,
      });
      next(error);
    }
  };

  // GET /students-distribution?criteria=gender|level|paymentStatus
  studentsDistribution = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const criteria = (req.query.criteria as string) || 'gender';

      if (criteria === 'gender') {
        const profiles = await this.statRepo.findStudentsGenderDistribution(user.schoolId);
        const counts = new Map<string, number>();
        for (const p of profiles) {
          const label = p.gender || 'Non renseigné';
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        res.json({ success: true, data: Array.from(counts, ([label, count]) => ({ label, count })) });
        return;
      }

      if (criteria === 'level') {
        const profiles = await this.statRepo.findStudentsLevelDistribution(user.schoolId);
        const counts = new Map<string, number>();
        for (const p of profiles) {
          const label = p.enrollmentsYearScoped?.[0]?.class?.level || 'Non assigné';
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        res.json({ success: true, data: Array.from(counts, ([label, count]) => ({ label, count })) });
        return;
      }

      if (criteria === 'paymentStatus') {
        const invoices = await this.statRepo.findInvoicesPaymentStatuses(user.schoolId);

        const byStudent = new Map<string, Set<string>>();
        for (const inv of invoices) {
          if (!byStudent.has(inv.studentId)) byStudent.set(inv.studentId, new Set());
          byStudent.get(inv.studentId)!.add(inv.status);
        }

        const counts = new Map<string, number>();
        for (const statuses of byStudent.values()) {
          let label: string;
          if (statuses.has('OVERDUE')) label = 'En retard';
          else if (statuses.has('PENDING') || statuses.has('PARTIAL')) label = 'En attente';
          else label = 'À jour';
          counts.set(label, (counts.get(label) ?? 0) + 1);
        }
        res.json({ success: true, data: Array.from(counts, ([label, count]) => ({ label, count })) });
        return;
      }

      res.status(400).json({ success: false, message: 'Critère invalide. Utilisez gender, level ou paymentStatus.' });
    } catch (error) {
      next(error);
    }
  };

  // GET /teacher-performance/:teacherId — généralisation de DepartmentController.performance par enseignant
  teacherPerformance = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      const teacherId = req.params.teacherId as string;

      const teacher = await this.statRepo.findTeacherById(user.schoolId, teacherId);
      if (!teacher) {
        res.status(404).json({ success: false, message: 'Enseignant introuvable' });
        return;
      }

      const assignments = await this.statRepo.findTeachingAssignmentsForTeacher(user.schoolId, teacherId);

      const heuresPrevuesParSemaine = assignments.reduce((sum, a) => sum + a.subject.hoursPerWeek, 0);
      const subjectIds = [...new Set(assignments.map((a) => a.subjectId))];
      const classIds = [...new Set(assignments.map((a) => a.classId))];

      const grades = subjectIds.length > 0
        ? await this.statRepo.findGradesForTeacherPerformance(user.schoolId, subjectIds, classIds)
        : [];

      const gradeIndex = new Map<string, number[]>();
      for (const g of grades) {
        const key = `${g.subjectId}__${g.classId}`;
        if (!gradeIndex.has(key)) gradeIndex.set(key, []);
        if (g.sequenceAverage !== null) gradeIndex.get(key)!.push(g.sequenceAverage);
      }

      const moyennesParClasse = assignments.map((a) => {
        const key = `${a.subjectId}__${a.classId}`;
        const avgs = gradeIndex.get(key) ?? [];
        // ponytail: simple avg, stdlib 1-liner — centralize when weighted coeffs diverge
        const moyenne = avgs.length > 0 ? Math.round((avgs.reduce((s, v) => s + v, 0) / avgs.length) * 100) / 100 : null;
        return { subjectName: a.subject.name, className: a.class.name, moyenne, nbEleves: avgs.length };
      });

      // T4 migré vers MetricDefinition — taux agrégé via moteur (teacherId → classIds[] → Attendance IN)
      let tauxPresence: number;
      let attendances: Array<{ status: string; date: Date; classId: string; subjectId: string }> = [];
      if (this.getMetric) {
        const res = await this.getMetric.execute({ key: 'taux_presence', dimensions: { schoolId: user.schoolId, teacherId } });
        tauxPresence = res.value;
        // Toujours charger les attendances pour seancesEnregistrees (distinct date__class__subject)
        attendances = classIds.length > 0
          ? await this.statRepo.findAttendanceForTeacher(user.schoolId, teacherId, classIds)
          : [];
      } else {
        attendances = classIds.length > 0
          ? await this.statRepo.findAttendanceForTeacher(user.schoolId, teacherId, classIds)
          : [];
        tauxPresence = attendances.length > 0
          ? Math.round((attendances.filter((a) => a.status === 'PRESENT' || a.status === 'LATE').length / attendances.length) * 10000) / 100
          : 100;
      }

      const seancesEnregistrees = new Set(
        attendances.map((a) => `${a.date.toISOString().slice(0, 10)}__${a.classId}__${a.subjectId}`)
      ).size;

      res.json({
        success: true,
        data: {
          teacherName: `${teacher.firstName} ${teacher.lastName}`,
          heuresPrevuesParSemaine,
          seancesEnregistrees,
          tauxPresence,
          moyennesParClasse,
        },
      });
    } catch (error) {
      next(error);
    }
  };
}
