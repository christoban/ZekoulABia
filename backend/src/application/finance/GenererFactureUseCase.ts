/**
 * APPLICATION LAYER — Use Case : Générer une facture pour un élève
 */
import { Facture } from '@domain/entities/Facture';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { PlanFraisRepository } from '@domain/ports/repositories/PlanFraisRepository';

export interface GenererFactureCommande {
  schoolId: string;
  studentId: string;
  feePlanId: string;
  description?: string;
}

export interface GenererFactureResultat {
  factureId: string;
  studentId: string;
  amount: number;
  status: string;
}

export class GenererFactureUseCase {
  constructor(
    private readonly factureRepository: FactureRepository,
    private readonly planFraisRepository: PlanFraisRepository,
  ) {}

  async execute(commande: GenererFactureCommande): Promise<GenererFactureResultat> {
    // 1. Vérifier que le plan existe
    const plan = await this.planFraisRepository.findById(commande.feePlanId);
    if (!plan) throw new Error(`Plan de frais introuvable : ${commande.feePlanId}`);
    if (plan.schoolId !== commande.schoolId) {
      throw new Error("Ce plan n'appartient pas à votre établissement");
    }
    if (!plan.estPublie()) {
      throw new Error(
        `Le plan de frais « ${plan.name} » n'est pas publié — facturation impossible`
      );
    }

    // 2. Loi 3 — vérifier seuil légal si scolarité
    if (plan.estScolarite()) {
      const seuil = await this.planFraisRepository.getSeuilLegalTuition(
        commande.schoolId, 'SECOND'
      );
      plan.verifierSeuilLegal(seuil);
    }

    // 3. Créer la facture
    const facture = Facture.create({
      schoolId: commande.schoolId,
      studentId: commande.studentId,
      feePlanId: commande.feePlanId,
      amount: plan.amount,
      currency: plan.currency,
      dueDate: plan.dueDate,
      description: commande.description ?? plan.name,
    });

    await this.factureRepository.save(facture);

    return {
      factureId: facture.id,
      studentId: facture.studentId,
      amount: facture.amount,
      status: facture.status,
    };
  }
}
