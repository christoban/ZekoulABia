/**
 * APPLICATION LAYER — SupprimerPublicationUseCase
 */

import type { PublicationRepository } from '../../domain/ports/repositories/PublicationRepository';
import { peutSupprimerPublication } from '../../domain/rules/BabillardPermissionRules';
import type { UtilisateurContexte } from '../../domain/rules/BabillardVisibilityRules';

export interface SupprimerPublicationCommande {
  user: UtilisateurContexte;
  id: string;
}

export class SupprimerPublicationUseCase {
  constructor(private readonly repo: PublicationRepository) {}

  async execute(cmd: SupprimerPublicationCommande): Promise<void> {
    const existante = await this.repo.trouverParId(cmd.id, cmd.user.schoolId);
    if (!existante) {
      throw new Error('PUBLICATION_NOT_FOUND');
    }

    if (!peutSupprimerPublication(cmd.user, existante.auteurId)) {
      throw new Error('FORBIDDEN_DELETE_PUBLICATION');
    }

    await this.repo.supprimerLogique(cmd.id, cmd.user.schoolId);

    // Audit trail
    await this.repo.enregistrerAudit({
      schoolId: cmd.user.schoolId,
      publicationId: cmd.id,
      userId: cmd.user.userId,
      action: 'DELETE',
      details: {
        titre: existante.titre,
      },
    });
  }
}
