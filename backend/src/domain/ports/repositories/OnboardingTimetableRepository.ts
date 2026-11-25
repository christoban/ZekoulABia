/**
 * DOMAIN LAYER — Port Repository OnboardingTimetable
 * Vérifie la présence d'une configuration de grille horaire lors de l'exécution de l'onboarding.
 */

export interface OnboardingTimetableRepository {
  hasTimetableGridConfig(schoolId: string): Promise<boolean>;
}
