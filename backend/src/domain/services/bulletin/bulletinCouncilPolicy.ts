/**
 * DOMAIN LAYER — Politique configurable des distinctions & sanctions du conseil de classe
 *
 * Dérive Tableau d'honneur, Encouragements, Félicitations, Avertissement/Blâme travail
 * exclusivement depuis la moyenne générale, le rang et les seuils configurés (jamais cochés par défaut).
 */
import type { BulletinCouncilDecisionSnapshot } from '@domain/types/bulletinSnapshot';
import type { CouncilDistinctionThresholds } from '@domain/types/bulletinTemplateSpec';

export const DEFAULT_COUNCIL_DISTINCTION_THRESHOLDS: Readonly<CouncilDistinctionThresholds> = Object.freeze({
  honorRollMinAverage: 12,
  honorRollMaxRank: 10,
  encouragementsMinAverage: 14,
  encouragementsMaxRank: 5,
  congratulationsMinAverage: 16,
  congratulationsMaxRank: 3,
  workWarningMaxAverage: 10,
  workBlameMaxAverage: 8,
});

export function resolveEffectiveCouncilThresholds(
  custom?: Partial<CouncilDistinctionThresholds>,
): CouncilDistinctionThresholds {
  return {
    honorRollMinAverage: custom?.honorRollMinAverage ?? DEFAULT_COUNCIL_DISTINCTION_THRESHOLDS.honorRollMinAverage,
    honorRollMaxRank:
      custom && 'honorRollMaxRank' in custom
        ? custom.honorRollMaxRank
        : DEFAULT_COUNCIL_DISTINCTION_THRESHOLDS.honorRollMaxRank,
    encouragementsMinAverage:
      custom?.encouragementsMinAverage ?? DEFAULT_COUNCIL_DISTINCTION_THRESHOLDS.encouragementsMinAverage,
    encouragementsMaxRank:
      custom && 'encouragementsMaxRank' in custom
        ? custom.encouragementsMaxRank
        : DEFAULT_COUNCIL_DISTINCTION_THRESHOLDS.encouragementsMaxRank,
    congratulationsMinAverage:
      custom?.congratulationsMinAverage ?? DEFAULT_COUNCIL_DISTINCTION_THRESHOLDS.congratulationsMinAverage,
    congratulationsMaxRank:
      custom && 'congratulationsMaxRank' in custom
        ? custom.congratulationsMaxRank
        : DEFAULT_COUNCIL_DISTINCTION_THRESHOLDS.congratulationsMaxRank,
    workWarningMaxAverage:
      custom?.workWarningMaxAverage ?? DEFAULT_COUNCIL_DISTINCTION_THRESHOLDS.workWarningMaxAverage,
    workBlameMaxAverage:
      custom?.workBlameMaxAverage ?? DEFAULT_COUNCIL_DISTINCTION_THRESHOLDS.workBlameMaxAverage,
  };
}

export function resolveCouncilDistinctions(params: {
  generalAverage: number;
  rank: number;
  totalStudents: number;
  passThresholdOn20?: number;
  thresholds?: Partial<CouncilDistinctionThresholds>;
  isAnnual?: boolean;
  promotedToClass?: string | null;
  repeatClass?: string | null;
  observations?: string | null;
}): BulletinCouncilDecisionSnapshot {
  const t = resolveEffectiveCouncilThresholds(params.thresholds);
  const avg = params.generalAverage;
  const rk = params.rank;
  const passThreshold = params.passThresholdOn20 ?? 10;

  const rankWithin = (maxRank?: number): boolean => maxRank === undefined || rk <= maxRank;
  const honorRoll = avg >= t.honorRollMinAverage && rankWithin(t.honorRollMaxRank);
  const encouragements = honorRoll && avg >= t.encouragementsMinAverage && rankWithin(t.encouragementsMaxRank);
  const congratulations =
    encouragements && avg >= t.congratulationsMinAverage && rankWithin(t.congratulationsMaxRank);

  const workWarning = avg < t.workWarningMaxAverage;
  const workBlame = avg < t.workBlameMaxAverage;

  const decision =
    avg >= passThreshold ? 'PASS' : avg >= Math.max(0, passThreshold - 2) ? 'DELIBERATION' : 'REPEAT';

  return {
    decision,
    observations: params.observations ?? null,
    honorRoll,
    encouragements,
    congratulations,
    workWarning,
    workBlame,
    promotedToClass: params.isAnnual && decision === 'PASS' ? (params.promotedToClass ?? 'Classe supérieure') : null,
    repeatClass: params.isAnnual && decision === 'REPEAT' ? (params.repeatClass ?? 'Même classe') : null,
  };
}

