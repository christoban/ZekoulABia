import type { MessagerieRepository } from '@domain/ports/repositories/MessagerieRepository';
import type { RealtimeSocketPort } from '@domain/ports/services/RealtimeSocketPort';

export interface ChangerParametresCanalCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
  conversationId: string;
  announcementsOnly: boolean;
}

export class ChangerParametresCanalUseCase {
  constructor(
    private readonly messagerieRepository: MessagerieRepository,
    private readonly realtimeSocket: RealtimeSocketPort,
  ) {}

  async execute(cmd: ChangerParametresCanalCommande) {
    const role = cmd.appelantRole.toUpperCase();
    if (role === 'STUDENT' || role === 'PARENT') {
      throw new Error("Vous n'avez pas l'autorisation de modifier les paramètres de ce groupe.");
    }

    const conversation = await this.messagerieRepository.trouverConversation(cmd.conversationId, cmd.schoolId);
    if (!conversation) {
      throw new Error('Conversation introuvable.');
    }

    if (conversation.type !== 'CLASS_CHANNEL' && conversation.type !== 'PARENT_CHANNEL') {
      throw new Error('Ce type de conversation ne permet pas de modifier ce paramètre.');
    }

    if (role === 'TEACHER') {
      if (!conversation.classId) {
        throw new Error('Canal de classe sans identifiant de classe associé.');
      }
      const estEnseignant = await this.messagerieRepository.estEnseignantDeLaClasse(cmd.appelantId, conversation.classId);
      if (!estEnseignant) {
        throw new Error("Vous n'enseignez pas dans cette classe pour modifier ses paramètres.");
      }
    }

    const updated = await this.messagerieRepository.changerParametresCanal(conversation.id, {
      announcementsOnly: cmd.announcementsOnly,
    });

    this.realtimeSocket.emitter(`conversation:${conversation.id}`, 'conversation:settings-updated', {
      conversationId: conversation.id,
      announcementsOnly: cmd.announcementsOnly,
    });

    return updated;
  }
}
