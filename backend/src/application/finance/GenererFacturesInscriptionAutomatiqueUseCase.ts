/**
 * APPLICATION LAYER — Use Case : Génération automatique des factures lors de l'activation d'inscription
 *
 * Déclenché suite à l'événement `enrollment.activated`.
 * Associe l'élève aux plans de frais éligibles (TUITION, REGISTRATION) selon son niveau de classe.
 * Idempotent : ne recrée jamais une facture si l'élève en possède déjà une pour ce plan.
 */
import { Facture } from '@domain/entities/Facture';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { PlanFraisRepository } from '@domain/ports/repositories/PlanFraisRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

export interface GenererFacturesInscriptionCommande {
  schoolId: string;
  studentUserId: string;
  classId: string;
  academicYearId?: string;
}

export interface GenererFacturesInscriptionResultat {
  facturesCrees: number;
  ignores: number;
  facturesIds: string[];
}

export class GenererFacturesInscriptionAutomatiqueUseCase {
  constructor(
    private readonly factureRepository: FactureRepository,
    private readonly planFraisRepository: PlanFraisRepository,
    private readonly classeRepository: ClasseRepository,
  ) {}

  async execute(
    commande: GenererFacturesInscriptionCommande
  ): Promise<GenererFacturesInscriptionResultat> {
    const { schoolId, studentUserId, classId, academicYearId } = commande;

    // 1. Récupérer la classe pour connaître le niveau et l'année académique
    const classe = await this.classeRepository.findById(classId);
    const classLevel = classe?.level?.trim().toLowerCase();
    const effectiveAcademicYearId = academicYearId || classe?.academicYearId;

    // 2. Récupérer les plans de frais publiés de l'établissement
    const tousLesPlans = effectiveAcademicYearId
      ? await this.planFraisRepository.findByAcademicYear(schoolId, effectiveAcademicYearId)
      : await this.planFraisRepository.findBySchool(schoolId);

    // Filtrer : status PUBLISHED + types TUITION ou INSCRIPTION
    const plansEligibles = tousLesPlans.filter((plan) => {
      if (!plan.estPublie()) return false;
      if (plan.feeType !== 'TUITION' && plan.feeType !== 'INSCRIPTION') return false;

      // Correspondance du niveau si le plan cible un niveau précis
      if (plan.level && plan.level.trim()) {
        const planLevel = plan.level.trim().toLowerCase();
        if (!classLevel || planLevel !== classLevel) {
          return false;
        }
      }

      return true;
    });

    if (plansEligibles.length === 0) {
      return { facturesCrees: 0, ignores: 0, facturesIds: [] };
    }

    // 3. Charger les factures déjà existantes pour cet élève (Idempotence)
    const facturesExistantes = await this.factureRepository.findByEleve(studentUserId);
    const dejaBilledPlanIds = new Set(
      facturesExistantes.map((f) => f.feePlanId).filter(Boolean)
    );

    let facturesCrees = 0;
    let ignores = 0;
    const facturesIds: string[] = [];

    // 4. Créer les factures manquantes
    for (const plan of plansEligibles) {
      if (dejaBilledPlanIds.has(plan.id)) {
        ignores++;
        continue;
      }

      const nouvelleFacture = Facture.create({
        schoolId,
        studentId: studentUserId,
        feePlanId: plan.id,
        amount: plan.amount,
        currency: plan.currency,
        dueDate: plan.dueDate,
        description: plan.name,
      });

      await this.factureRepository.save(nouvelleFacture);
      facturesCrees++;
      facturesIds.push(nouvelleFacture.id);
    }

    return {
      facturesCrees,
      ignores,
      facturesIds,
    };
  }
}
