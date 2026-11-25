/**
 * APPLICATION LAYER — Use Case : Obtenir les alertes de solde impayé du parent connecté
 *
 * Assistant proactif (Section 6.3 du plan Copilot Unifié) — bannière affichée à la
 * connexion, indépendante du copilot conversationnel : on ne demande rien au parent,
 * on l'informe si un de ses enfants a un solde dû.
 */
import type { ParentRepository } from '@domain/ports/repositories/ParentRepository';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';

export interface AlerteSoldeEnfant {
  studentId: string;
  nomComplet: string;
  montantDu: number;
}

const STATUTS_EN_ATTENTE = ['PENDING', 'PARTIAL', 'OVERDUE'];

export class ObtenirAlertesSoldeUseCase {
  constructor(
    private readonly parentRepository: ParentRepository,
    private readonly factureRepository: FactureRepository,
  ) {}

  async execute(params: { parentUserId: string; schoolId: string }): Promise<AlerteSoldeEnfant[]> {
    const enfants = await this.parentRepository.findEnfantsAvecStats(params.parentUserId, params.schoolId);
    const alertes: AlerteSoldeEnfant[] = [];

    for (const enfant of enfants) {
      const factures = await this.factureRepository.findByEleve(enfant.studentId);
      const enAttente = factures.filter((f) => STATUTS_EN_ATTENTE.includes(f.status));
      if (enAttente.length === 0) continue;

      let montantDu = 0;
      for (const facture of enAttente) {
        const paye = await this.factureRepository.calculerTotalPayeAvecSucces(facture.id);
        montantDu += Math.max(0, facture.amount - paye);
      }
      if (montantDu > 0) {
        alertes.push({
          studentId: enfant.studentId,
          nomComplet: `${enfant.prenom} ${enfant.nom}`,
          montantDu,
        });
      }
    }

    return alertes;
  }
}
