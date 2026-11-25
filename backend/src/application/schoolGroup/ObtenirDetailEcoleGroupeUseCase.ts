/**
 * APPLICATION LAYER — Détail agrégé d'UNE école du groupe.
 * Toujours des agrégats, jamais une liste d'élèves nominative (Section 4 du plan).
 * L'appartenance de schoolId au groupe doit être vérifiée par l'appelant (contrôleur) via
 * req.groupOwner.schoolIds — ce use case ne refait pas cette vérification, il fait confiance
 * à la frontière déjà posée par protectGroupOwner + le contrôleur.
 */
import type { GroupeScolaireQueryRepository } from '@domain/ports/repositories/GroupeScolaireQueryRepository';

export class ObtenirDetailEcoleGroupeUseCase {
  constructor(private readonly queryRepository: GroupeScolaireQueryRepository) {}

  async execute(schoolId: string) {
    const school = await this.queryRepository.trouverEcoleDetail(schoolId);
    if (!school) {
      throw new Error('École introuvable');
    }

    const kpis = await this.queryRepository.calculerKpisEcole(schoolId);

    return { ...school, ...kpis };
  }
}
