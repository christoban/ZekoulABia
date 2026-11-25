import type { StudentFollowUpRepository, FollowUpActionDetail } from '@domain/ports/repositories/StudentFollowUpRepository';
import type { AppelantSuivi } from './CreerActionSuiviEleveUseCase';

export interface ClorreActionSuiviCommande {
  appelant: AppelantSuivi;
  actionId: string;
  closingNote: string;
}

/** Rôle autorisé (B.4) : la personne assignée, ou le créateur — personne d'autre, pas même un rôle habilité. */
export class ClorreActionSuiviUseCase {
  constructor(private readonly repo: StudentFollowUpRepository) {}

  async execute(cmd: ClorreActionSuiviCommande): Promise<FollowUpActionDetail> {
    if (!cmd.closingNote?.trim()) {
      throw new Error('Une note de clôture est obligatoire');
    }

    const action = await this.repo.findById(cmd.actionId, cmd.appelant.schoolId);
    if (!action) throw new Error('Action de suivi introuvable');

    if (action.status === 'CLOS') {
      throw new Error('Cette action est déjà clôturée');
    }

    const estAutorise = cmd.appelant.userId === action.assignedToId || cmd.appelant.userId === action.createdById;
    if (!estAutorise) {
      throw new Error('Seuls le créateur ou la personne assignée peuvent clôturer cette action');
    }

    return this.repo.close(cmd.actionId, cmd.appelant.userId, cmd.closingNote.trim());
  }
}
