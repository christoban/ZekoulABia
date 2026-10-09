/**
 * APPLICATION LAYER — Use Case : Créer un plan de frais
 * Loi 3 : vérifie le seuil légal Art. 48 avant création.
 * Lance SeuilLegalDepasseError si dépassement → blocage réel
 * (contrairement à l'ancien code qui loggait seulement).
 */
import { PlanFrais } from '@domain/entities/PlanFrais';
import type { PlanFraisRepository } from '@domain/ports/repositories/PlanFraisRepository';
import type { FeeType } from '@domain/types/enums';

export interface CreerPlanFraisCommande {
  schoolId: string;
  sectionId?: string;
  name: string;
  amount: number;
  currency?: string;
  feeType: FeeType;
  level?: string;
  isRefundable?: boolean;
  dueDate?: Date;
  description?: string;
  demandeurRole: string;
}

export interface CreerPlanFraisResultat {
  planId: string;
  name: string;
  amount: number;
  feeType: FeeType;
}

export class CreerPlanFraisUseCase {
  constructor(private readonly planFraisRepository: PlanFraisRepository) {}

  async execute(commande: CreerPlanFraisCommande): Promise<CreerPlanFraisResultat> {
    // 1. Créer l'entité (validation interne)
    const plan = PlanFrais.create({
      schoolId: commande.schoolId,
      sectionId: commande.sectionId,
      name: commande.name,
      amount: commande.amount,
      currency: commande.currency,
      feeType: commande.feeType,
      level: commande.level,
      isRefundable: commande.isRefundable,
      dueDate: commande.dueDate,
      description: commande.description,
      status: commande.demandeurRole === 'ADMIN' ? 'PUBLISHED' : 'PENDING_VALIDATION',
    });

    // 2. Loi 3 — vérifier le seuil légal pour les frais de scolarité
    if (plan.estScolarite()) {
      const cycle = commande.level?.includes('6e') ||
                    commande.level?.includes('5e') ||
                    commande.level?.includes('4e') ||
                    commande.level?.includes('3e') ||
                    commande.level?.toLowerCase().includes('form1') ||
                    commande.level?.toLowerCase().includes('form2') ||
                    commande.level?.toLowerCase().includes('form3')
        ? 'FIRST' : 'SECOND';

      const seuilLegal = await this.planFraisRepository.getSeuilLegalTuition(
        commande.schoolId,
        cycle
      );

      // Lance SeuilLegalDepasseError si dépassement (bloquant — pas juste un log)
      plan.verifierSeuilLegal(seuilLegal);
    }

    // 3. Sauvegarder
    await this.planFraisRepository.save(plan);

    return {
      planId: plan.id,
      name: plan.name,
      amount: plan.amount,
      feeType: plan.feeType,
    };
  }
}
