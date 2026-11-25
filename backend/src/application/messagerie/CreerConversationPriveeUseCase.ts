import type { MessagerieRepository, ConversationRef } from '@domain/ports/repositories/MessagerieRepository';

export interface CreerConversationPriveeCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
  destinataireId: string;
}

/**
 * Crée ou récupère une conversation privée (DM) entre deux utilisateurs.
 * Interdit formellement aux élèves d'initier un DM.
 */
export class CreerConversationPriveeUseCase {
  constructor(private readonly messagerieRepository: MessagerieRepository) {}

  async execute(cmd: CreerConversationPriveeCommande): Promise<ConversationRef> {
    const role = cmd.appelantRole.toUpperCase();
    if (role === 'STUDENT') {
      throw new Error('Les élèves ne sont pas autorisés à créer de message privé.');
    }
    if (cmd.appelantId === cmd.destinataireId) {
      throw new Error('Impossible de créer une conversation privée avec soi-même.');
    }

    const existante = await this.messagerieRepository.trouverConversationPriveeExistante(
      cmd.schoolId,
      cmd.appelantId,
      cmd.destinataireId,
    );
    if (existante) {
      return existante;
    }

    return this.messagerieRepository.creerConversationPrivee(
      cmd.schoolId,
      cmd.appelantId,
      cmd.destinataireId,
    );
  }
}
