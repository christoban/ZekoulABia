/**
 * APPLICATION LAYER — CalculerStatistiquesLectureUseCase
 * Calcule "Lu par X sur Y destinataires" pour les auteurs et administrateurs.
 */

import type { PublicationRepository, StatistiquesLecture } from '../../domain/ports/repositories/PublicationRepository';
import { peutGererToutesPublications } from '../../domain/rules/BabillardPermissionRules';
import type { UtilisateurContexte } from '../../domain/rules/BabillardVisibilityRules';

export class CalculerStatistiquesLectureUseCase {
  constructor(private readonly repo: PublicationRepository) {}

  async execute(user: UtilisateurContexte, publicationId: string): Promise<StatistiquesLecture> {
    const pub = await this.repo.trouverParId(publicationId, user.schoolId);
    if (!pub) {
      throw new Error('PUBLICATION_NOT_FOUND');
    }

    const estAuteur = user.userId === pub.auteurId;
    const aManageAny = peutGererToutesPublications(user);
    if (!estAuteur && !aManageAny) {
      throw new Error('FORBIDDEN_VIEW_STATISTICS');
    }

    return this.repo.obtenirStatistiquesLecture(pub);
  }
}
