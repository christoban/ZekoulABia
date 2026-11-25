/**
 * APPLICATION LAYER — ModifierPublicationUseCase
 */

import type { Publication, PublicationProps } from '../../domain/entities/Publication';
import type { PublicationRepository } from '../../domain/ports/repositories/PublicationRepository';
import { peutModifierPublication } from '../../domain/rules/BabillardPermissionRules';
import type { UtilisateurContexte } from '../../domain/rules/BabillardVisibilityRules';

export interface ModifierPublicationCommande {
  user: UtilisateurContexte;
  id: string;
  data: Partial<PublicationProps>;
}

export class ModifierPublicationUseCase {
  constructor(private readonly repo: PublicationRepository) {}

  async execute(cmd: ModifierPublicationCommande): Promise<Publication> {
    const existante = await this.repo.trouverParId(cmd.id, cmd.user.schoolId);
    if (!existante) {
      throw new Error('PUBLICATION_NOT_FOUND');
    }

    if (!peutModifierPublication(cmd.user, existante.auteurId)) {
      throw new Error('FORBIDDEN_UPDATE_PUBLICATION');
    }

    const maintenant = new Date();
    const donneesModifiees: Partial<PublicationProps> = {
      ...cmd.data,
      modifieLe: maintenant,
      updatedAt: maintenant,
    };

    const modifiee = await this.repo.modifier(cmd.id, cmd.user.schoolId, donneesModifiees);

    // Audit trail
    await this.repo.enregistrerAudit({
      schoolId: cmd.user.schoolId,
      publicationId: cmd.id,
      userId: cmd.user.userId,
      action: 'UPDATE',
      details: {
        champsModifies: Object.keys(cmd.data),
      },
    });

    return modifiee;
  }
}
