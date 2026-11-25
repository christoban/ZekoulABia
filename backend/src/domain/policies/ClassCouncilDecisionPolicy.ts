import type { CouncilDecision } from '../types/enums';

export const VALID_DECISIONS: CouncilDecision[] = ['PASS', 'REPEAT', 'DELIBERATION'];

export function isValidDecision(decision: string): decision is CouncilDecision {
  return (VALID_DECISIONS as string[]).includes(decision);
}

export const DECISION_LABEL: Record<CouncilDecision, string> = {
  PASS: 'ADMIS(E)',
  REPEAT: 'REDOUBLE',
  DELIBERATION: 'DÉLIBÉRATION',
};

export const DECISION_COLOR: Record<CouncilDecision, string> = {
  PASS: '#15803d',
  REPEAT: '#b91c1c',
  DELIBERATION: '#b45309',
};
