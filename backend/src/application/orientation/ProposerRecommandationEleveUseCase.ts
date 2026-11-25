import type { IOrientationRepository, RecommandationDetail, CheckpointConfigDetail } from '@domain/ports/repositories/IOrientationRepository';

export interface ProposerRecommandationEleveCommande {
  recommandationId: string;
  schoolId: string;
}

export class ProposerRecommandationEleveUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(cmd: ProposerRecommandationEleveCommande): Promise<RecommandationDetail> {
    const reco = await this.repo.findRecommandationById(cmd.recommandationId, cmd.schoolId);
    if (!reco) throw new Error('Recommandation introuvable');
    if (reco.status !== 'VALIDEE_CONSEILLER') {
      throw new Error(`Cette recommandation doit d'abord être validée par le conseiller (statut actuel : ${reco.status})`);
    }
    if (!reco.checkpointType) throw new Error('Recommandation sans checkpoint associé');

    const config = await this.repo.findCheckpointConfig(cmd.schoolId, reco.checkpointType) as CheckpointConfigDetail;
    const deadlineDays = config?.responseDeadlineDays ?? 15;
    const responseDeadline = new Date(Date.now() + deadlineDays * 24 * 60 * 60 * 1000);

    return this.repo.proposerRecommandationEleve(cmd.recommandationId, responseDeadline);
  }
}
