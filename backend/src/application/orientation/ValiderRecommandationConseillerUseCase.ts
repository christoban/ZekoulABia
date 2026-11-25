import type { IOrientationRepository, RecommandationDetail } from '@domain/ports/repositories/IOrientationRepository';

export interface ValiderRecommandationConseillerCommande {
  recommandationId: string;
  schoolId: string;
  // Piste retenue par le conseiller — reprend en général la mieux notée par le moteur (Section
  // A.1.2 : le conseiller valide OU ajuste la proposition), mais reste éditable ici.
  serieRecommandee: string;
}

export class ValiderRecommandationConseillerUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(cmd: ValiderRecommandationConseillerCommande): Promise<RecommandationDetail> {
    const reco = await this.repo.findRecommandationById(cmd.recommandationId, cmd.schoolId);
    if (!reco) throw new Error('Recommandation introuvable');
    if (reco.status !== 'CALCULEE') {
      throw new Error(`Cette recommandation ne peut pas être validée depuis son statut actuel (${reco.status})`);
    }
    return this.repo.validerRecommandationConseiller(cmd.recommandationId, cmd.serieRecommandee);
  }
}
