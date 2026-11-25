import type { AnneeAcademiqueRepository } from '@domain/ports/repositories/AnneeAcademiqueRepository';
import type { PromotionRepository } from '@domain/ports/repositories/PromotionRepository';
import type { ActivityLogPort } from '@domain/ports/services/ActivityLogPort';
import { VerifierPrerequisClotureUseCase } from './VerifierPrerequisClotureUseCase';

export interface CloturerAnneeCommande {
  academicYearId: string;
  schoolId: string;
  demandeurId: string;
  force?: boolean;
}

export interface CloturerAnneeResultat {
  anneeId: string;
  elevesPromus: number;
  elevesRedoublants: number;
  elevesNonTraites: number;
  avertissements: string[];
}

export class CloturerAnneeUseCase {
  private readonly verifierPrerequis: VerifierPrerequisClotureUseCase;

  constructor(
    private readonly anneeRepository: AnneeAcademiqueRepository,
    private readonly promotionRepository: PromotionRepository,
    private readonly activityLog: ActivityLogPort,
  ) {
    this.verifierPrerequis = new VerifierPrerequisClotureUseCase(anneeRepository);
  }

  async execute(commande: CloturerAnneeCommande): Promise<CloturerAnneeResultat> {
    const { peutCloturer, bloqueurs } = await this.verifierPrerequis.execute(
      commande.academicYearId
    );

    if (!peutCloturer) {
      const bloqueursCritiques = commande.force
        ? bloqueurs.filter(b => b.type !== 'UNVALIDATED_GRADES')
        : bloqueurs;

      if (bloqueursCritiques.length > 0) {
        const messages = bloqueursCritiques.map(b => b.message).join(' | ');
        throw new Error(`Clôture impossible : ${messages}`);
      }
    }

    const annee = await this.anneeRepository.findById(commande.academicYearId);
    if (!annee) throw new Error(`Année académique introuvable : ${commande.academicYearId}`);
    if (annee.status === 'ARCHIVED') {
      throw new Error('Cette année est déjà archivée');
    }

    const anneeAvant = await this.anneeRepository.findById(commande.academicYearId);
    await this.anneeRepository.archiver(commande.academicYearId);

    const mappings = await this.promotionRepository.findMappingsPromotion(
      commande.schoolId,
      commande.academicYearId
    );
    const mappingMap = new Map(mappings.map(m => [m.fromClassId, m.toClassId]));

    const decisions = await this.promotionRepository.findDecisionsEleves(
      commande.schoolId,
      commande.academicYearId
    );

    let promus = 0;
    let redoublants = 0;
    let nonTraites = 0;
    const avertissements: string[] = [];

    for (const decision of decisions) {
      if (decision.decision === 'PASS' || decision.decision === 'DELIBERATION') {
        // Une recommandation d'orientation finalisée (fin 3ème / fin Seconde C) prime sur le
        // mapping générique classe→classe — c'est elle qui détermine la vraie destination
        // (niveau + série choisie), le mapping ne sert que pour les élèves hors checkpoint.
        const toClassId = await this.promotionRepository.findClasseCibleOrientation(
          commande.schoolId, decision.studentId, commande.academicYearId
        ) ?? mappingMap.get(decision.fromClassId);

        if (!toClassId) {
          avertissements.push(
            `Pas de mapping de promotion pour la classe ${decision.fromClassId} — élève ${decision.studentId} non déplacé`
          );
          nonTraites++;
          continue;
        }

        await this.promotionRepository.promouvoirEleve({
          schoolId: commande.schoolId,
          studentId: decision.studentId,
          fromClassId: decision.fromClassId,
          toClassId,
          academicYearId: commande.academicYearId,
          promotedById: commande.demandeurId,
        });

        await this.promotionRepository.mettreAJourClasseEleve(decision.studentId, toClassId, commande.demandeurId);
        promus++;
      } else if (decision.decision === 'REPEAT') {
        await this.promotionRepository.promouvoirEleve({
          schoolId: commande.schoolId,
          studentId: decision.studentId,
          fromClassId: decision.fromClassId,
          toClassId: decision.fromClassId,
          academicYearId: commande.academicYearId,
          promotedById: commande.demandeurId,
        });
        redoublants++;
      }
    }

    void this.activityLog.log({
      userId: commande.demandeurId,
      schoolId: commande.schoolId,
      action: 'Année clôturée',
      details: JSON.stringify({
        anneeId: commande.academicYearId,
        avant: anneeAvant?.status,
        apres: 'ARCHIVED',
        promus, redoublants, nonTraites,
      }),
    });

    return {
      anneeId: commande.academicYearId,
      elevesPromus: promus,
      elevesRedoublants: redoublants,
      // Bug indépendant trouvé en retravaillant ce use case : ce champ était toujours à 0,
      // codé en dur, alors que la branche ci-dessus pousse déjà un avertissement pour chaque
      // élève sans mapping — le rapport de clôture minimisait silencieusement les élèves
      // réellement non traités.
      elevesNonTraites: nonTraites,
      avertissements,
    };
  }
}
