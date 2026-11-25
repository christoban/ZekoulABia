/**
 * APPLICATION LAYER — MarquerPublicationLueUseCase
 */

import type { PublicationRepository } from '../../domain/ports/repositories/PublicationRepository';
import { peutVoir, type UtilisateurContexte } from '../../domain/rules/BabillardVisibilityRules';

export class MarquerPublicationLueUseCase {
  constructor(private readonly repo: PublicationRepository) {}

  async execute(user: UtilisateurContexte, publicationId: string): Promise<void> {
    const pub = await this.repo.trouverParId(publicationId, user.schoolId);
    if (!pub) {
      throw new Error('PUBLICATION_NOT_FOUND');
    }

    if (!peutVoir(user, pub, { inclureArchives: true })) {
      throw new Error('FORBIDDEN_READ_PUBLICATION');
    }

    await this.repo.marquerCommeLu(publicationId, user.userId, user.schoolId);
  }
}
