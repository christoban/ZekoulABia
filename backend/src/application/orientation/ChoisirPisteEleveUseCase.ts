import type { IOrientationRepository, RecommandationDetail } from '@domain/ports/repositories/IOrientationRepository';

export interface ChoisirPisteEleveCommande {
  recommandationId: string;
  schoolId: string;
  studentId: string; // vérifie que l'élève agit bien sur SA propre recommandation
  track: string;
}

export class ChoisirPisteEleveUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(cmd: ChoisirPisteEleveCommande): Promise<RecommandationDetail> {
    const reco = await this.repo.findRecommandationById(cmd.recommandationId, cmd.schoolId);
    const target = reco && reco.studentId === cmd.studentId ? reco : null;
    if (!target) throw new Error('Recommandation introuvable');
    if (target.status !== 'PROPOSEE_A_L_ELEVE') {
      throw new Error(`Cette recommandation n'est plus en attente de votre réponse (statut actuel : ${target.status})`);
    }
    if (target.responseDeadline && target.responseDeadline.getTime() < Date.now()) {
      throw new Error('Le délai de réponse est dépassé — la décision par défaut du conseiller a été retenue');
    }

    const pistesDisponibles = (target.suggestedTracks as Array<{ track: string }> | null)?.map((t) => t.track) ?? [];
    if (!pistesDisponibles.includes(cmd.track)) {
      throw new Error('Cette piste ne fait pas partie de celles proposées');
    }

    return this.repo.choisirPisteEleve(cmd.recommandationId, cmd.track);
  }
}
