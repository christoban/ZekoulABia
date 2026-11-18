/**
 * DOMAIN LAYER — Port Repository OnboardingStream
 * Encapsule l'accès aux combinaisons de filières anglophones pour l'onboarding.
 */

export interface AnglophoneStreamCombinationRecord {
  id: string;
  filiere: string;
  type: string;
  coreSubjects: unknown;
  electiveGroup: unknown;
  description: string | null;
}

export interface OnboardingStreamRepository {
  listAnglophoneStreamCombinations(): Promise<AnglophoneStreamCombinationRecord[]>;
}
