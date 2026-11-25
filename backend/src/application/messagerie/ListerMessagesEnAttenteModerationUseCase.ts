import type { MessagerieRepository } from '@domain/ports/repositories/MessagerieRepository';

export interface ListerMessagesEnAttenteModerationCommande {
  schoolId: string;
  appelantRole: string;
}

/** File d'attente de modération pour le Staff/Admin — n'a de sens que si activée pour l'école. */
export class ListerMessagesEnAttenteModerationUseCase {
  constructor(private readonly messagerieRepository: MessagerieRepository) {}

  async execute(cmd: ListerMessagesEnAttenteModerationCommande) {
    if (!['ADMIN', 'STAFF'].includes(cmd.appelantRole.toUpperCase())) {
      throw new Error('Seuls Admin et Staff peuvent consulter la file de modération.');
    }

    return this.messagerieRepository.listerEnAttenteModeration(cmd.schoolId);
  }
}
