export interface BulletinPolicyConfig {
  attendanceLateAsAbsence?: boolean;
  attendanceExcusedCountsAsAbsence?: boolean;
  councilDecisionMode?: "manual" | "automatic";
  councilPassAverageThreshold?: number;
  councilMaxAbsences?: number;
  bulletinBlockOnUnpaidFees?: boolean;
  bulletinAllowedOutstandingBalance?: number;
}

export const DEFAULT_BULLETIN_POLICY: Required<BulletinPolicyConfig> = {
  attendanceLateAsAbsence: true,
  attendanceExcusedCountsAsAbsence: false,
  councilDecisionMode: "automatic",
  councilPassAverageThreshold: 50,
  councilMaxAbsences: 10,
  bulletinBlockOnUnpaidFees: false,
  bulletinAllowedOutstandingBalance: 0,
};

export const resolveBulletinPolicy = (config?: BulletinPolicyConfig | null) => ({
  attendanceLateAsAbsence:
    typeof config?.attendanceLateAsAbsence === "boolean"
      ? config.attendanceLateAsAbsence
      : DEFAULT_BULLETIN_POLICY.attendanceLateAsAbsence,
  attendanceExcusedCountsAsAbsence:
    typeof config?.attendanceExcusedCountsAsAbsence === "boolean"
      ? config.attendanceExcusedCountsAsAbsence
      : DEFAULT_BULLETIN_POLICY.attendanceExcusedCountsAsAbsence,
  councilDecisionMode: config?.councilDecisionMode || DEFAULT_BULLETIN_POLICY.councilDecisionMode,
  councilPassAverageThreshold:
    typeof config?.councilPassAverageThreshold === "number"
      ? config.councilPassAverageThreshold
      : DEFAULT_BULLETIN_POLICY.councilPassAverageThreshold,
  councilMaxAbsences:
    typeof config?.councilMaxAbsences === "number"
      ? config.councilMaxAbsences
      : DEFAULT_BULLETIN_POLICY.councilMaxAbsences,
  bulletinBlockOnUnpaidFees:
    typeof config?.bulletinBlockOnUnpaidFees === "boolean"
      ? config.bulletinBlockOnUnpaidFees
      : DEFAULT_BULLETIN_POLICY.bulletinBlockOnUnpaidFees,
  bulletinAllowedOutstandingBalance:
    typeof config?.bulletinAllowedOutstandingBalance === "number"
      ? config.bulletinAllowedOutstandingBalance
      : DEFAULT_BULLETIN_POLICY.bulletinAllowedOutstandingBalance,
});

export const calculateCouncilDecision = (params: {
  averagePercentage: number;
  absences: number;
  lateCount: number;
  policy: BulletinPolicyConfig;
}) => {
  const policy = resolveBulletinPolicy(params.policy);

  if (policy.councilDecisionMode === "manual") {
    return "TO_BE_REVIEWED";
  }

  if (params.absences > policy.councilMaxAbsences) {
    return "ABSENCE_REVIEW";
  }

  if (params.averagePercentage >= policy.councilPassAverageThreshold) {
    return "PROMOTED";
  }

  if (params.lateCount > 0) {
    return "CONDUCT_REVIEW";
  }

  return "REMEDIAL";
};