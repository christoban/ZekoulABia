/**
 * DOMAIN LAYER — Logique métier pure
 * Aucune dépendance externe autorisée dans ce fichier.
 */

export type GradingScale = "OVER_20" | "PERCENT" | "GRADES_AE" | "COMPETENCY_ANA";

type GradeComputationInput = {
  rawScore: number;
  maxScore: number;
};

type AggregateInput = {
  scoreOn20: number;
  percentage: number;
  coefficient?: number;
  isAbsentGrade?: boolean;
};

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const normalizeScoreOn20 = ({ rawScore, maxScore }: GradeComputationInput) => {
  if (!Number.isFinite(maxScore) || maxScore <= 0) return 0;
  const score = (Number(rawScore) / Number(maxScore)) * 20;
  return Number(clamp(score, 0, 20).toFixed(2));
};

export const scoreOn20ToPercentage = (scoreOn20: number) =>
  Number(clamp(Number(scoreOn20) * 5, 0, 100).toFixed(2));

export const normalizePassThresholdOn20 = (
  passThreshold: number,
  gradingScale: GradingScale
) => {
  const numeric = Number(passThreshold);
  if (!Number.isFinite(numeric)) return 10;

  if (gradingScale === "OVER_20" || gradingScale === "COMPETENCY_ANA") {
    return Number(clamp(numeric, 0, 20).toFixed(2));
  }

  const scoreOn20 = numeric > 20 ? numeric / 5 : numeric;
  return Number(clamp(scoreOn20, 0, 20).toFixed(2));
};

const scoreToGradeAE = (scoreOn20: number) => {
  if (scoreOn20 >= 16) return "A";
  if (scoreOn20 >= 13) return "B";
  if (scoreOn20 >= 10) return "C";
  if (scoreOn20 >= 8) return "D";
  return "E";
};

const scoreToCompetency = (scoreOn20: number) => {
  if (scoreOn20 >= 12) return "A";
  if (scoreOn20 >= 8) return "ECA";
  return "NA";
};

export const formatGradeLabel = (scoreOn20: number, gradingScale: GradingScale) => {
  if (gradingScale === "OVER_20") {
    return `${Number(scoreOn20.toFixed(2))}/20`;
  }

  if (gradingScale === "PERCENT") {
    return `${scoreOn20ToPercentage(scoreOn20)}%`;
  }

  if (gradingScale === "GRADES_AE") {
    return scoreToGradeAE(scoreOn20);
  }

  return scoreToCompetency(scoreOn20);
};

export const calculateAverageScoreOn20 = (
  grades: AggregateInput[],
  hasCoefficientBySubject: boolean,
  excludeAbsentGrades: boolean = false,
) => {
  // Filtrer les notes d'absents si demandé (croisement Grade/Attendance)
  const filteredGrades = excludeAbsentGrades
    ? grades.filter((g) => !g.isAbsentGrade)
    : grades;

  if (!filteredGrades.length) return 0;

  if (!hasCoefficientBySubject) {
    const simpleAverage = filteredGrades.reduce((sum, grade) => sum + Number(grade.scoreOn20 || 0), 0) / filteredGrades.length;
    return Number(clamp(simpleAverage, 0, 20).toFixed(2));
  }

  // `?? 1` et non `|| 1` : un coefficient explicitement à 0 (matière exclue du calcul) doit
  // rester 0, pas être silencieusement remplacé par 1 — seul un coefficient absent
  // (null/undefined) doit retomber sur la valeur par défaut 1.
  const weightedTotal = filteredGrades.reduce(
    (sum, grade) => sum + Number(grade.scoreOn20 || 0) * Number(grade.coefficient ?? 1),
    0
  );
  const coefficientTotal = filteredGrades.reduce((sum, grade) => sum + Number(grade.coefficient ?? 1), 0) || 1;
  return Number(clamp(weightedTotal / coefficientTotal, 0, 20).toFixed(2));
};

// ─── Calcul moyenne séquence ─────────────────────────────────────────────────

export type SequenceCalculationMode = 'single' | 'triple' | 'weighted';

export type SequenceAverageInput = {
  sequenceScore?: number | null;
  classTestScore?: number | null;
  terminalExamScore?: number | null;
  theoreticalScore?: number | null;
  practicalScore?: number | null;
  maxValue: number;
  seq1Score?: number | null;
  seq2Score?: number | null;
  compositionScore?: number | null;
};

/**
 * Calcule la moyenne d'une séquence selon le mode de calcul configuré pour l'école.
 *
 * - `weighted` : 30% devoir + 70% composition (si les deux existent)
 * - `triple`   : (DS1 + DS2 + Composition×2) / 4 (si les trois existent)
 * - `single`   : sequenceScore, ou (theoretical+practical)/2, ou weighted fallback
 */
export function calculerMoyenneSequence(
  grade: SequenceAverageInput,
  mode: SequenceCalculationMode = 'single',
): number {
  const max = grade.maxValue || 20;

  if (mode === 'weighted' && grade.classTestScore != null && grade.terminalExamScore != null) {
    const raw = grade.classTestScore * 0.3 + grade.terminalExamScore * 0.7;
    return Number(clamp(raw, 0, max).toFixed(2));
  }

  if (mode === 'triple') {
    const ds1 = grade.seq1Score ?? grade.sequenceScore;
    const ds2 = grade.seq2Score;
    const compo = grade.compositionScore;
    if (ds1 != null && ds2 != null && compo != null) {
      const raw = (ds1 + ds2 + compo * 2) / 4;
      return Number(clamp(raw, 0, max).toFixed(2));
    }
  }

  if (grade.sequenceScore != null) return Number(clamp(grade.sequenceScore, 0, max).toFixed(2));
  if (grade.theoreticalScore != null && grade.practicalScore != null) {
    const raw = (grade.theoreticalScore + grade.practicalScore) / 2;
    return Number(clamp(raw, 0, max).toFixed(2));
  }
  if (grade.classTestScore != null && grade.terminalExamScore != null) {
    const raw = grade.classTestScore * 0.3 + grade.terminalExamScore * 0.7;
    return Number(clamp(raw, 0, max).toFixed(2));
  }

  return 0;
}

