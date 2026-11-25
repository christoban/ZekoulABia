/**
 * APPLICATION LAYER — Use Case : Modifier un plan de frais
 *
 * Permet à l'intendant (STAFF) ou à l'administrateur de modifier :
 * - Le montant (amount)
 * - Le nom (name)
 * - La description
 * - Le niveau (level)
 * - L'échéance (dueDate)
 * - Le statut (si validation/publication directe)
 *
 * Déclenche automatiquement la facturation pour tous les élèves concernés
 * dès que le plan est publié avec un montant > 0.
 */
import type { PlanFraisRepository } from '@domain/ports/repositories/PlanFraisRepository';
import type { FeePlanStatus } from '@domain/types/enums';
import { SeuilLegalDepasseError } from '@domain/errors/SeuilLegalDepasseError';
import type { GenererFacturesEnMasseUseCase } from './GenererFacturesEnMasseUseCase';

export interface ModifierPlanFraisCommande {
  schoolId: string;
  demandeurRole: string;
  feePlanId: string;
  name?: string;
  amount?: number;
  description?: string;
  level?: string | null;
  dueDate?: Date | null;
  status?: FeePlanStatus;
}

export interface ModifierPlanFraisResultat {
  planId: string;
  name: string;
  amount: number;
  status: FeePlanStatus;
  facturesGenerees?: number;
}

export class ModifierPlanFraisUseCase {
  constructor(
    private readonly planFraisRepository: PlanFraisRepository,
    private readonly genererFacturesEnMasse?: GenererFacturesEnMasseUseCase,
  ) {}

  async execute(commande: ModifierPlanFraisCommande): Promise<ModifierPlanFraisResultat> {
    const plan = await this.planFraisRepository.findById(commande.feePlanId);
    if (!plan) throw new Error(`Plan de frais introuvable : ${commande.feePlanId}`);
    if (plan.schoolId !== commande.schoolId) {
      throw new Error("Ce plan n'appartient pas à votre établissement");
    }

    const nouveauMontant = commande.amount !== undefined ? Number(commande.amount) : plan.amount;
    const nouveauStatut = commande.status ?? plan.status;

    // Si le plan est ou devient publié, le montant doit être strictement positif
    if (nouveauStatut === 'PUBLISHED' && nouveauMontant <= 0) {
      throw new Error('Le montant doit être supérieur à 0 pour un plan publié');
    }

    // Règle de gouvernance / RBAC :
    // Un utilisateur non-ADMIN ne peut pas promouvoir directement un plan non publié au statut PUBLISHED.
    // L'intendant (STAFF) prépare le plan en DRAFT ou le soumet en PENDING_VALIDATION.
    // Seul l'administrateur (Direction) peut valider et publier (PUBLISHED).
    if (nouveauStatut === 'PUBLISHED' && plan.status !== 'PUBLISHED' && commande.demandeurRole !== 'ADMIN') {
      throw new Error(
        "Seul l'administrateur (Direction) est habilité à valider et publier un plan de frais. L'intendant peut l'enregistrer en brouillon ou le soumettre pour validation."
      );
    }

    // Loi 3 — Art. 48 MINESEC (Vérification du seuil légal si frais de scolarité)
    if (plan.estScolarite() && nouveauMontant > 0) {
      const seuil = await this.planFraisRepository.getSeuilLegalTuition(commande.schoolId, 'SECOND');
      if (nouveauMontant > seuil) {
        throw new SeuilLegalDepasseError(nouveauMontant, seuil, commande.name ?? plan.name);
      }
    }

    plan.modifier({
      name: commande.name,
      amount: commande.amount !== undefined ? Number(commande.amount) : undefined,
      description: commande.description,
      level: commande.level,
      dueDate: commande.dueDate ? new Date(commande.dueDate) : commande.dueDate,
      status: commande.status,
    });

    await this.planFraisRepository.update(plan);

    // Auto-facturation immédiate si le plan est publié et a un montant > 0
    let facturesGenerees = 0;
    if (plan.status === 'PUBLISHED' && plan.amount > 0 && this.genererFacturesEnMasse) {
      try {
        const res = await this.genererFacturesEnMasse.execute({
          schoolId: plan.schoolId,
          feePlanId: plan.id,
        });
        facturesGenerees = res.crees;
      } catch (err) {
        console.error('[ModifierPlanFrais] Échec auto-génération factures:', err);
      }
    }

    return {
      planId: plan.id,
      name: plan.name,
      amount: plan.amount,
      status: plan.status,
      facturesGenerees,
    };
  }
}
