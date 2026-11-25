import type { IOrientationRepository, RecommandationDetail } from '@domain/ports/repositories/IOrientationRepository';

export interface CreerRecommandationCommande {
  ficheId:          string;
  schoolId:         string;
  serieActuelle:    string;
  serieRecommandee: string;
  justification:    string;
}

export class CreerRecommandationSerieUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(cmd: CreerRecommandationCommande): Promise<RecommandationDetail> {
    const fiche = await this.repo.findFicheById(cmd.ficheId, cmd.schoolId);
    if (!fiche) throw new Error('Fiche d\'orientation introuvable');
    if (!fiche.estOuverte()) {
      throw new Error('Impossible de créer une recommandation sur une fiche clôturée');
    }

    return this.repo.createOrUpdateRecommandation(cmd.ficheId, fiche.studentId, {
      serieActuelle:    cmd.serieActuelle,
      serieRecommandee: cmd.serieRecommandee,
      justification:   cmd.justification,
    });
  }
}
