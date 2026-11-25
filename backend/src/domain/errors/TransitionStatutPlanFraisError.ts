/**
 * DOMAIN LAYER — Erreur de transition de statut d'un plan de frais.
 * Workflow V1.11 : DRAFT → PENDING_VALIDATION → APPROVED → PUBLISHED.
 */
export class TransitionStatutPlanFraisError extends Error {
  constructor(planName: string, statutActuel: string, statutCible: string) {
    super(
      `Transition de statut invalide pour le plan « ${planName} » : ` +
      `${statutActuel} → ${statutCible} n'est pas autorisée.`
    );
    this.name = 'TransitionStatutPlanFraisError';
  }
}