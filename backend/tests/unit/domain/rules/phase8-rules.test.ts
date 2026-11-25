import { describe, expect, test } from "bun:test";
import {
  calculateAverageScoreOn20,
  formatGradeLabel,
  normalizeScoreOn20,
  scoreOn20ToPercentage,
} from '../../../../src/domain/rules/GradingEngine.ts';
import { calculateCouncilDecision } from '../../../../src/domain/policies/BulletinPolicy.ts';
import { resolveBulletinTemplateType } from '../../../../src/domain/policies/BulletinTemplatePolicy.ts';

type PilotScenario = {
  id: "FR" | "EN" | "BILINGUAL" | "COMPLEX";
  cycle: "maternelle" | "primaire" | "secondaire_1" | "secondaire_2" | "technique";
  language: "fr" | "en";
  subSystemCode: any;
  gradingScale: "OVER_20" | "PERCENT" | "GRADES_AE" | "COMPETENCY_ANA";
  councilPassAverageThreshold: number;
  councilMaxAbsences: number;
  attendanceLateAsAbsence: boolean;
  bulletinBlockOnUnpaidFees: boolean;
  bulletinAllowedOutstandingBalance: number;
  rawScores: Array<{ rawScore: number; maxScore: number; coefficient: number }>;
  lateCount: number;
  absences: number;
  outstandingBalance: number;
  expectedTemplate: "FR" | "EN" | "PRIMARY" | "KINDERGARTEN";
};

const scenarios: PilotScenario[] = [
  {
    id: "FR",
    cycle: "secondaire_1",
    language: "fr",
    subSystemCode: "FR_GENERAL_SEC",
    gradingScale: "OVER_20",
    councilPassAverageThreshold: 50,
    councilMaxAbsences: 10,
    attendanceLateAsAbsence: true,
    bulletinBlockOnUnpaidFees: false,
    bulletinAllowedOutstandingBalance: 0,
    rawScores: [
      { rawScore: 14, maxScore: 20, coefficient: 2 },
      { rawScore: 12, maxScore: 20, coefficient: 1 },
    ],
    lateCount: 1,
    absences: 2,
    outstandingBalance: 0,
    expectedTemplate: "FR",
  },
  {
    id: "EN",
    cycle: "secondaire_1",
    language: "en",
    subSystemCode: "EN_GENERAL_SEC",
    gradingScale: "PERCENT",
    councilPassAverageThreshold: 40,
    councilMaxAbsences: 8,
    attendanceLateAsAbsence: false,
    bulletinBlockOnUnpaidFees: false,
    bulletinAllowedOutstandingBalance: 0,
    rawScores: [
      { rawScore: 32, maxScore: 40, coefficient: 1 },
      { rawScore: 24, maxScore: 40, coefficient: 1 },
    ],
    lateCount: 0,
    absences: 1,
    outstandingBalance: 0,
    expectedTemplate: "EN",
  },
  {
    id: "BILINGUAL",
    cycle: "primaire",
    language: "en",
    subSystemCode: "EN_PRIMAIRE",
    gradingScale: "GRADES_AE",
    councilPassAverageThreshold: 45,
    councilMaxAbsences: 6,
    attendanceLateAsAbsence: true,
    bulletinBlockOnUnpaidFees: false,
    bulletinAllowedOutstandingBalance: 0,
    rawScores: [
      { rawScore: 15, maxScore: 20, coefficient: 1 },
      { rawScore: 16, maxScore: 20, coefficient: 1 },
    ],
    lateCount: 0,
    absences: 0,
    outstandingBalance: 0,
    expectedTemplate: "PRIMARY",
  },
  {
    id: "COMPLEX",
    cycle: "maternelle",
    language: "fr",
    subSystemCode: "MATERNELLE",
    gradingScale: "COMPETENCY_ANA",
    councilPassAverageThreshold: 50,
    councilMaxAbsences: 5,
    attendanceLateAsAbsence: true,
    bulletinBlockOnUnpaidFees: true,
    bulletinAllowedOutstandingBalance: 10000,
    rawScores: [
      { rawScore: 10, maxScore: 20, coefficient: 1 },
      { rawScore: 11, maxScore: 20, coefficient: 1 },
    ],
    lateCount: 1,
    absences: 3,
    outstandingBalance: 25000,
    expectedTemplate: "KINDERGARTEN",
  },
];

describe("phase8 rules integration", () => {
  test("pilot scenarios produce coherent grading, council and finance outcomes", () => {
    for (const scenario of scenarios) {
      const grades = scenario.rawScores.map((item) => {
        const scoreOn20 = normalizeScoreOn20({ rawScore: item.rawScore, maxScore: item.maxScore });
        return {
          scoreOn20,
          percentage: scoreOn20ToPercentage(scoreOn20),
          coefficient: item.coefficient,
        };
      });

      const averageScoreOn20 = calculateAverageScoreOn20(grades, true);
      const averagePercentage = scoreOn20ToPercentage(averageScoreOn20);
      const label = formatGradeLabel(averageScoreOn20, scenario.gradingScale);
      const template = resolveBulletinTemplateType(
        scenario.subSystemCode,
        scenario.cycle,
        scenario.language
      );
      const effectiveAbsences =
        scenario.absences + (scenario.attendanceLateAsAbsence ? scenario.lateCount : 0);

      const decision = calculateCouncilDecision({
        averagePercentage,
        absences: effectiveAbsences,
        lateCount: scenario.lateCount,
        policy: {
          councilDecisionMode: "automatic",
          councilPassAverageThreshold: scenario.councilPassAverageThreshold,
          councilMaxAbsences: scenario.councilMaxAbsences,
        },
      });

      const bulletinBlocked =
        scenario.bulletinBlockOnUnpaidFees &&
        scenario.outstandingBalance > scenario.bulletinAllowedOutstandingBalance;

      expect(template).toBe(scenario.expectedTemplate);
      expect(averageScoreOn20).toBeGreaterThanOrEqual(0);
      expect(averageScoreOn20).toBeLessThanOrEqual(20);
      expect(label.length).toBeGreaterThan(0);
      expect(["PROMOTED", "ABSENCE_REVIEW", "CONDUCT_REVIEW", "REMEDIAL", "TO_BE_REVIEWED"]).toContain(
        decision
      );

      if (scenario.id === "COMPLEX") {
        expect(bulletinBlocked).toBe(true);
      }
    }
  });
});
