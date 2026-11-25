export type RiskAlertLevel = 'critical' | 'warning' | null;

export function resolveRiskAlertLevel(
  score: number,
  warningThreshold: number,
  criticalThreshold: number,
): RiskAlertLevel {
  if (score <= criticalThreshold) return 'critical';
  if (score <= warningThreshold) return 'warning';
  return null;
}
