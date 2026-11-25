/**
 * APPLICATION LAYER — Use Case : Reconduire les plans de frais vers une nouvelle année scolaire
 *
 * Ne copie JAMAIS silencieusement — la liste de plans à créer est fournie explicitement par
 * l'appelant (revue humaine côté frontend : montants modifiables, plans à ne pas reconduire
 * simplement absents de la liste). Ce use case ne fait qu'exécuter la création demandée.
 *
 * Loi 3 (Art. 48 MINESEC) dupliquée intentionnellement depuis CreerPlanFraisUseCase plutôt que
 * factorisée — ce dernier ne doit pas être modifié (périmètre du chantier), la logique de
 * vérification du seuil légal doit néanmoins s'appliquer également ici pour toute reconduction
 * de frais de scolarité.
 */
import { PlanFrais } from '@domain/entities/PlanFrais';
import type { PlanFraisRepository } from '@domain/ports/repositories/PlanFraisRepository';
import type { FeeType } from '@domain/types/enums';

export interface PlanFraisACopier {
  name: string;
  amount: number;
  feeType: FeeType;
  sectionId?: string;
  level?: string;
  isRefundable?: boolean;
  dueDate?: Date;
  description?: string;
}

export interface CopierPlansFraisAnneePrecedenteCommande {
  schoolId: string;
  targetAcademicYearId: string;
  plans: PlanFraisACopier[];
}

export interface CopierPlansFraisAnneePrecedenteResultat {
  crees: number;
  planIds: string[];
  erreurs: { name: string; message: string }[];
}

export class CopierPlansFraisAnneePrecedenteUseCase {
  constructor(private readonly planFraisRepository: PlanFraisRepository) {}

  async execute(commande: CopierPlansFraisAnneePrecedenteCommande): Promise<CopierPlansFraisAnneePrecedenteResultat> {
    const planIds: string[] = [];
    const erreurs: { name: string; message: string }[] = [];

    // Pas de tout-ou-rien : un plan en échec (ex. dépassement du seuil légal) n'empêche pas
    // la création des autres — reporté dans `erreurs` plutôt qu'une exception qui laisserait
    // les plans déjà créés dans les itérations précédentes sans que l'appelant le sache.
    for (const p of commande.plans) {
      try {
        const plan = PlanFrais.create({
          schoolId: commande.schoolId,
          sectionId: p.sectionId,
          name: p.name,
          amount: p.amount,
          feeType: p.feeType,
          level: p.level,
          isRefundable: p.isRefundable,
          dueDate: p.dueDate,
          description: p.description,
          academicYearId: commande.targetAcademicYearId,
        });

        // Loi 3 — même vérification que CreerPlanFraisUseCase pour les frais de scolarité.
        if (plan.estScolarite()) {
          const cycle = p.level?.includes('6e') ||
                        p.level?.includes('5e') ||
                        p.level?.includes('4e') ||
                        p.level?.includes('3e') ||
                        p.level?.toLowerCase().includes('form1') ||
                        p.level?.toLowerCase().includes('form2') ||
                        p.level?.toLowerCase().includes('form3')
            ? 'FIRST' : 'SECOND';

          const seuilLegal = await this.planFraisRepository.getSeuilLegalTuition(commande.schoolId, cycle);
          plan.verifierSeuilLegal(seuilLegal);
        }

        await this.planFraisRepository.save(plan);
        planIds.push(plan.id);
      } catch (error) {
        erreurs.push({ name: p.name, message: error instanceof Error ? error.message : 'Erreur inconnue' });
      }
    }

    return { crees: planIds.length, planIds, erreurs };
  }
}
