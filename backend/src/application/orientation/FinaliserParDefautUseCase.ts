import type { IOrientationRepository, RecommandationDetail } from '@domain/ports/repositories/IOrientationRepository';

/**
 * À l'échéance sans réponse de l'élève (A.1.2 étape 4) — la piste retenue par le conseiller
 * (serieRecommandee) devient la piste finale. Retourne les recommandations finalisées, à charge
 * de l'appelant (job Inngest) de notifier.
 */
export class FinaliserParDefautUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(schoolId: string): Promise<RecommandationDetail[]> {
    const enAttente = await this.repo.findRecommandationsParStatut(schoolId, 'PROPOSEE_A_L_ELEVE');
    const now = Date.now();
    const finalisees: RecommandationDetail[] = [];

    for (const reco of enAttente) {
      if (!reco.responseDeadline || reco.responseDeadline.getTime() > now) continue;
      const updated = await this.repo.finaliserParDefaut(reco.id);
      finalisees.push(updated);
    }

    return finalisees;
  }
}
