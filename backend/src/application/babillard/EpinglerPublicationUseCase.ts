/**
 * APPLICATION LAYER — EpinglerPublicationUseCase
 */

import type { Publication } from '../../domain/entities/Publication';
import type { PublicationRepository } from '../../domain/ports/repositories/PublicationRepository';
import { peutEpinglerBabillard } from '../../domain/rules/BabillardPermissionRules';
import type { UtilisateurContexte } from '../../domain/rules/BabillardVisibilityRules';

export class EpinglerPublicationUseCase {
  constructor(private readonly repo: PublicationRepository) {}

  async execute(
    user: UtilisateurContexte,
    publicationId: string,
    epinglee: boolean
  ): Promise<Publication> {
    if (!peutEpinglerBabillard(user)) {
      throw new Error('FORBIDDEN_PIN_PUBLICATION');
    }

    const pub = await this.repo.trouverParId(publicationId, user.schoolId);
    if (!pub) {
      throw new Error('PUBLICATION_NOT_FOUND');
    }

    if (epinglee) {
      const nbEpingles = await this.repo.compterEpinglesActifs(user.schoolId);
      if (nbEpingles >= 3 && !pub.epinglee) {
        await this.repo.desepinglerLaPlusAncienne(user.schoolId);
      }
    }

    const updated = await this.repo.epingler(publicationId, user.schoolId, epinglee);

    // Audit trail
    await this.repo.enregistrerAudit({
      schoolId: user.schoolId,
      publicationId,
      userId: user.userId,
      action: epinglee ? 'PIN' : 'UNPIN',
      details: { titre: pub.titre },
    });

    return updated;
  }
}
