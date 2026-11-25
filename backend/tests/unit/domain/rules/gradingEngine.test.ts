import { describe, expect, test } from "bun:test";
import {
  calculateAverageScoreOn20,
  formatGradeLabel,
  normalizePassThresholdOn20,
  normalizeScoreOn20,
  scoreOn20ToPercentage,
} from '../../../../src/domain/rules/GradingEngine.ts';

describe("gradingEngine", () => {
  test("normalizeScoreOn20 converts and clamps correctly", () => {
    expect(normalizeScoreOn20({ rawScore: 15, maxScore: 20 })).toBe(15);
    expect(normalizeScoreOn20({ rawScore: 120, maxScore: 20 })).toBe(20);
    expect(normalizeScoreOn20({ rawScore: 5, maxScore: 0 })).toBe(0);
  });

  test("scoreOn20ToPercentage converts and clamps correctly", () => {
    expect(scoreOn20ToPercentage(10)).toBe(50);
    expect(scoreOn20ToPercentage(25)).toBe(100);
  });

  test("normalizePassThresholdOn20 handles OVER_20 and PERCENT modes", () => {
    expect(normalizePassThresholdOn20(10, "OVER_20")).toBe(10);
    expect(normalizePassThresholdOn20(40, "PERCENT")).toBe(8);
    expect(normalizePassThresholdOn20(200, "PERCENT")).toBe(20);
  });

  test("formatGradeLabel returns labels by grading scale", () => {
    expect(formatGradeLabel(13.5, "OVER_20")).toBe("13.5/20");
    expect(formatGradeLabel(12, "PERCENT")).toBe("60%");
    expect(formatGradeLabel(17, "GRADES_AE")).toBe("A");
    expect(formatGradeLabel(9, "COMPETENCY_ANA")).toBe("ECA");
  });

  test("calculateAverageScoreOn20 supports simple and weighted averages", () => {
    const grades = [
      { scoreOn20: 10, percentage: 50, coefficient: 2 },
      { scoreOn20: 14, percentage: 70, coefficient: 1 },
    ];

    expect(calculateAverageScoreOn20(grades, false)).toBe(12);
    expect(calculateAverageScoreOn20(grades, true)).toBe(11.33);
  });

  test("calculateAverageScoreOn20 treats an explicit coefficient of 0 as a real zero, not a missing value", () => {
    // Une matière à coefficient 0 (ex. non comptée dans la moyenne) doit être totalement
    // exclue du calcul — ne doit jamais être silencieusement remplacée par coefficient 1.
    const gradesAvecMatiereExclue = [
      { scoreOn20: 14, percentage: 70, coefficient: 0 },
      { scoreOn20: 10, percentage: 50, coefficient: 2 },
    ];
    // Seule la 2e note (coefficient 2) doit compter : moyenne = 10, pas une pondération de 14 et 10.
    expect(calculateAverageScoreOn20(gradesAvecMatiereExclue, true)).toBe(10);

    // Si TOUTES les matières ont coefficient 0, la moyenne doit être 0 (pas NaN, pas 1-par-défaut).
    const toutesLesMatieresExclues = [
      { scoreOn20: 14, percentage: 70, coefficient: 0 },
      { scoreOn20: 9, percentage: 45, coefficient: 0 },
    ];
    expect(calculateAverageScoreOn20(toutesLesMatieresExclues, true)).toBe(0);

    // Un coefficient réellement absent (undefined), lui, doit toujours retomber sur le défaut 1 —
    // à ne pas confondre avec un coefficient explicitement mis à 0.
    const coefficientAbsent = [
      { scoreOn20: 10, percentage: 50 },
      { scoreOn20: 14, percentage: 70, coefficient: 1 },
    ];
    expect(calculateAverageScoreOn20(coefficientAbsent, true)).toBe(12);
  });

  // Croisement Grade/Attendance : un 7/20 d'un absent n'est plus traité comme un 7/20 d'un présent
  test("calculateAverageScoreOn20 excludes absent grades when excludeAbsentGrades is true", () => {
    // 2 matières : Maths = 7/20 (élève présent), Français = 14/20 (élève absent)
    const grades = [
      { scoreOn20: 7, percentage: 35, coefficient: 2, isAbsentGrade: false },
      { scoreOn20: 14, percentage: 70, coefficient: 1, isAbsentGrade: true },
    ];

    // Sans exclusion : moyenne pondérée = (7*2 + 14*1) / (2+1) = 28/3 = 9.33
    expect(calculateAverageScoreOn20(grades, true)).toBe(9.33);

    // Avec exclusion : seule la note de Maths compte (7/20)
    expect(calculateAverageScoreOn20(grades, true, true)).toBe(7);
  });

  test("calculateAverageScoreOn20 returns 0 when all grades are absent and exclusion is on", () => {
    const grades = [
      { scoreOn20: 7, percentage: 35, coefficient: 2, isAbsentGrade: true },
      { scoreOn20: 14, percentage: 70, coefficient: 1, isAbsentGrade: true },
    ];
    expect(calculateAverageScoreOn20(grades, true, true)).toBe(0);
  });
});
