import type { IOrientationRepository, RecommandationDetail } from '@domain/ports/repositories/IOrientationRepository';

const SEUIL_RELANCE_JOURS = 5;
const DELAI_MIN_ENTRE_RELANCES_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Rappels à l'approche de l'échéance (A.1.2 étape 3) — n'envoie jamais plus d'une relance tous
 * les 2 jours pour la même recommandation, et seulement dans les 5 derniers jours avant le délai.
 * Retourne la liste des recommandations relancées, à charge de l'appelant (job Inngest) d'envoyer
 * la notification effective — même séparation que le reste du projet (use case ne notifie jamais).
 */
export class RelancerElevesEnAttenteUseCase {
  constructor(private readonly repo: IOrientationRepository) {}

  async execute(schoolId: string): Promise<RecommandationDetail[]> {
    const enAttente = await this.repo.findRecommandationsParStatut(schoolId, 'PROPOSEE_A_L_ELEVE');
    const now = Date.now();
    const aRelancer: RecommandationDetail[] = [];

    for (const reco of enAttente) {
      if (!reco.responseDeadline) continue;
      const msRestants = reco.responseDeadline.getTime() - now;
      if (msRestants <= 0) continue; // dépassé — géré par FinaliserParDefautUseCase
      if (msRestants > SEUIL_RELANCE_JOURS * 24 * 60 * 60 * 1000) continue;

      const rappels = Array.isArray(reco.remindersSentAt) ? (reco.remindersSentAt as string[]) : [];
      const dernierRappel = rappels.length > 0 ? new Date(rappels[rappels.length - 1]!).getTime() : 0;
      if (now - dernierRappel < DELAI_MIN_ENTRE_RELANCES_MS) continue;

      await this.repo.ajouterRappelEnvoye(reco.id);
      aRelancer.push(reco);
    }

    return aRelancer;
  }
}
