/**
 * APPLICATION LAYER — Use Case : Changer le statut d'un plan de frais
 * Workflow V1.11 : DRAFT → PENDING_VALIDATION → APPROVED → PUBLISHED.
 */
import type { PlanFraisRepository } from '@domain/ports/repositories/PlanFraisRepository';
import type { FeePlanStatus } from '@domain/types/enums';
import type { GenererFacturesEnMasseUseCase } from './GenererFacturesEnMasseUseCase';

export interface ChangerStatutPlanFraisCommande {
  schoolId: string;
  feePlanId: string;
  statutCible: FeePlanStatus;
}

export interface ChangerStatutPlanFraisResultat {
  planId: string;
  status: FeePlanStatus;
  facturesGenerees?: number;
}

export class ChangerStatutPlanFraisUseCase {
  constructor(
    private readonly planFraisRepository: PlanFraisRepository,
    private readonly genererFacturesEnMasse?: GenererFacturesEnMasseUseCase,
  ) {}

  async execute(
    commande: ChangerStatutPlanFraisCommande
  ): Promise<ChangerStatutPlanFraisResultat> {
    const plan = await this.planFraisRepository.findById(commande.feePlanId);
    if (!plan) throw new Error(`Plan de frais introuvable : ${commande.feePlanId}`);
    if (plan.schoolId !== commande.schoolId) {
      throw new Error("Ce plan n'appartient pas à votre établissement");
    }

    if (commande.statutCible === 'PUBLISHED' && plan.amount <= 0) {
      throw new Error("Impossible de publier un plan de frais dont le montant est de 0 FCFA. Veuillez d'abord définir son montant.");
    }

    // Transition validée par l'entité (lance TransitionStatutPlanFraisError si invalide)
    plan.changerStatut(commande.statutCible);

    await this.planFraisRepository.updateStatus(plan.id, plan.status);

    let facturesGenerees = 0;
    if (plan.status === 'PUBLISHED' && plan.amount > 0 && this.genererFacturesEnMasse) {
      try {
        const res = await this.genererFacturesEnMasse.execute({
          schoolId: plan.schoolId,
          feePlanId: plan.id,
        });
        facturesGenerees = res.crees;
      } catch (err) {
        console.error('[ChangerStatutPlanFrais] Échec auto-génération factures:', err);
      }
    }

    return { planId: plan.id, status: plan.status, facturesGenerees };
  }
}