import { describe, expect, test } from "bun:test";
import {
  calculateCouncilDecision,
  DEFAULT_BULLETIN_POLICY,
  resolveBulletinPolicy,
} from '../../../src/domain/policies/BulletinPolicy.ts';

describe("bulletinPolicy", () => {
  test("resolveBulletinPolicy returns defaults when config is missing", () => {
    const policy = resolveBulletinPolicy(null);
    expect(policy).toEqual(DEFAULT_BULLETIN_POLICY);
  });

  test("manual council mode forces TO_BE_REVIEWED", () => {
    const decision = calculateCouncilDecision({
      averagePercentage: 90,
      absences: 0,
      lateCount: 0,
      policy: { councilDecisionMode: "manual" },
    });

    expect(decision).toBe("TO_BE_REVIEWED");
  });

  test("absence threshold is evaluated before promotion", () => {
    const decision = calculateCouncilDecision({
      averagePercentage: 80,
      absences: 11,
      lateCount: 0,
      policy: { councilMaxAbsences: 10 },
    });

    expect(decision).toBe("ABSENCE_REVIEW");
  });

  test("promotion and remedial branches are evaluated correctly", () => {
    const promoted = calculateCouncilDecision({
      averagePercentage: 65,
      absences: 2,
      lateCount: 0,
      policy: { councilPassAverageThreshold: 60 },
    });

    const remedial = calculateCouncilDecision({
      averagePercentage: 35,
      absences: 0,
      lateCount: 0,
      policy: { councilPassAverageThreshold: 50 },
    });

    expect(promoted).toBe("PROMOTED");
    expect(remedial).toBe("REMEDIAL");
  });
});
