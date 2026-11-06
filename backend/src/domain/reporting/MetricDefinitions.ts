import type { MetricDefinition, MetricKey, MetricDimensions, MetricComputeFn, MetricComputeContext } from './MetricRegistry';
import { calculateAverageScoreOn20 } from '@domain/rules/GradingEngine';
import { resolveHasCoefficientForClass } from '@domain/subsystems/SubsystemDefaults';

export const METRIC_DEFINITIONS: Record<MetricKey, MetricDefinition> = {
  taux_presence: {
    key: 'taux_presence',
    dimensions: ['schoolId', 'classId', 'studentId', 'teacherId', 'dateRange', 'academicPeriodId'],
    defaultTtlMs: 2 * 60 * 1000,
    enabled: true,
  },
  moyenne_generale: {
    key: 'moyenne_generale',
    dimensions: ['schoolId', 'classId', 'studentId', 'sequenceId', 'academicPeriodId'],
    defaultTtlMs: 2 * 60 * 1000,
    enabled: true,
  },
};

/**
 * Réutilise EXACTEMENT la logique de PrismaPresenceRepository.findByClasseEtEleves / getStatistiquesEleve
 * (post-fix 4f7a9b9 : PRESENT+LATE comptent comme présent, 100 si total=0).
 * Pas de nouvelle requête : on appelle le repository existant via le port.
 */
export const computeTauxPresence: MetricComputeFn = async (dims, ctx: MetricComputeContext) => {
  const { presenceRepository, statisticsQueryRepository } = ctx;

  // Cas T4 — taux agrégé pour un enseignant (teacherId → classIds[] via TeachingAssignment, puis Attendance IN classIds)
  // Réutilise exactement la requête de PrismaStatisticsQueryRepository.findAttendanceForTeacher
  // (single findMany avec classId IN [...], pas de boucle par classe). Sans dateRange.
  if (dims.teacherId && !dims.dateRange && !dims.classId) {
    const assignments = await statisticsQueryRepository.findTeachingAssignmentsForTeacher(dims.schoolId, dims.teacherId);
    const classIds = [...new Set(assignments.map(a => a.classId))];
    if (classIds.length === 0) return 100;
    const attendances = await statisticsQueryRepository.findAttendanceForTeacher(dims.schoolId, dims.teacherId, classIds);
    if (attendances.length === 0) return 100;
    const presents = attendances.filter(a => a.status === 'PRESENT' || a.status === 'LATE').length;
    // 2 décimales comme avant migration (StatisticsController:232-233)
    return Math.round((presents / attendances.length) * 10000) / 100;
  }

  // Cas T7 — teacher + classId + dateRange (copilot mes_stats_presence_classe)
  if (dims.teacherId && dims.classId && dims.dateRange) {
    const depuis = new Date(dims.dateRange.from);
    const { present, total } = await presenceRepository.compterPresencesDepuis({
      schoolId: dims.schoolId,
      classId: dims.classId,
      teacherId: dims.teacherId,
      depuis,
    });
    if (total === 0) return 100;
    return Math.round((present / total) * 10000) / 100;
  }

  // Cas T8/T9 — studentId + dateRange (copilot ma_presence / presence_mon_enfant)
  if (dims.studentId && dims.dateRange) {
    const depuis = new Date(dims.dateRange.from);
    const { present, total } = await presenceRepository.compterPresencesDepuis({
      schoolId: dims.schoolId,
      studentId: dims.studentId,
      depuis,
    });
    if (total === 0) return 100;
    return Math.round((present / total) * 10000) / 100;
  }

  // Cas pilote ListerElevesClasse : classId + studentId (sans dateRange)
  if (dims.classId && dims.studentId) {
    const rows = await presenceRepository.findByClasseEtEleves(dims.classId, [dims.studentId]);
    if (rows.length === 0) return 100;
    const presents = rows.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;
    return Math.round((presents / rows.length) * 100);
  }

  // Cas générique par élève + période (academicPeriodId)
  if (dims.studentId && dims.academicPeriodId) {
    const stats = await presenceRepository.getStatistiquesEleve(dims.studentId, dims.academicPeriodId);
    return stats.tauxPresence;
  }

  // Pas de dimensions suffisantes — 100 par convention (même fallback que getStatistiquesEleve total=0)
  return 100;
};

/**
 * Réutilise GradingEngine.calculateAverageScoreOn20 avec :
 *  - excludeAbsentGrades FIGÉ à true (jamais une dimension)
 *  - hasCoefficientBySubject lu depuis la config école via le repository existant (SchoolConfigRepository.findBySchool).
 * Les notes proviennent de NoteRepository.findValideesParClasseEtEleves (notes LOCKED, source unique).
 */
export const computeMoyenneGenerale: MetricComputeFn = async (dims, ctx: MetricComputeContext) => {
  const { noteRepository } = ctx;

  if (!dims.classId || !dims.studentId) return 0;

  const grades = await noteRepository.findValideesParClasseEtEleves(dims.schoolId, dims.classId, [dims.studentId]);
  const calculable = grades.filter(g => g.sequenceAverage !== null && g.sequenceAverage !== undefined);
  if (calculable.length === 0) return 0;

  let hasCoefficientBySubject = true;
  try {
    const school = await ctx.schoolRepository.findById(dims.schoolId);
    const classe = await ctx.classeRepository.findById(dims.classId);
    if (school && classe) {
      hasCoefficientBySubject = resolveHasCoefficientForClass(school, classe.level ?? null);
    }
  } catch {
    // best-effort fallback
  }
  const excludeAbsentGrades = true; // FIGÉ — jamais une dimension (contrat Tech Lead)

  return calculateAverageScoreOn20(
    calculable.map(g => ({
      scoreOn20: g.sequenceAverage as number,
      percentage: 0,
      coefficient: g.coefficient ?? 1,
      isAbsentGrade: g.isAbsentGrade,
    })),
    hasCoefficientBySubject,
    excludeAbsentGrades,
  );
};

export const METRIC_COMPUTE_FNS: Record<MetricKey, MetricComputeFn> = {
  taux_presence: computeTauxPresence,
  moyenne_generale: computeMoyenneGenerale,
};