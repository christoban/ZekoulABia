/**
 * APPLICATION LAYER — L'Admin de l'école CIBLE rejette une demande de transfert.
 * Aucune donnée déplacée, aucun compte créé — juste un changement de statut.
 */
import type { GroupTransferRepository } from '@domain/ports/repositories/GroupTransferRepository';

export interface RejeterTransfertGroupeCommande {
  demandeId: string;
  targetSchoolId: string; // dérivé du token Admin, jamais du corps de la requête
}

export class RejeterTransfertGroupeUseCase {
  constructor(private readonly transfertRepository: GroupTransferRepository) {}

  async execute(cmd: RejeterTransfertGroupeCommande) {
    const demande = await this.transfertRepository.trouverParId(cmd.demandeId);
    if (!demande) throw new Error('Demande de transfert introuvable');
    if (demande.targetSchoolId !== cmd.targetSchoolId) throw new Error('Accès refusé');
    if (demande.status !== 'PENDING_TARGET_ADMIN') throw new Error(`Cette demande est déjà au statut ${demande.status}`);

    return this.transfertRepository.rejeter(demande.id);
  }
}
