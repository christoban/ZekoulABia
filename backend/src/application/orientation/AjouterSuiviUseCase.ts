import type { IOrientationRepository, SuiviDetail } from '@domain/ports/repositories/IOrientationRepository';
import type { NiveauRisque, TypePreoccupation } from '@domain/entities/FicheOrientation';

export interface AjouterSuiviCommande {
  ficheId:      string;
  schoolId:     string;
  riskLevel:    NiveauRisque;
  mainConcern:  TypePreoccupation;
  interventions?: string;
  prochainRdv?: Date;
  notes?:       string;
}

export class AjouterSuiviUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(cmd: AjouterSuiviCommande): Promise<SuiviDetail> {
    const fiche = await this.repo.findFicheById(cmd.ficheId, cmd.schoolId);
    if (!fiche) throw new Error('Fiche d\'orientation introuvable');
    if (!fiche.estOuverte()) {
      throw new Error('Impossible d\'ajouter un suivi à une fiche clôturée');
    }

    const suivi = await this.repo.createSuivi(cmd.ficheId, {
      riskLevel:    cmd.riskLevel,
      mainConcern:  cmd.mainConcern,
      interventions: cmd.interventions,
      prochainRdv:  cmd.prochainRdv,
      notes:        cmd.notes,
    });

    // Mettre à jour le niveau de risque de la fiche
    await this.repo.updateFicheRiskLevel(cmd.ficheId, cmd.riskLevel, cmd.mainConcern);

    return suivi;
  }
}
