import type { MessagerieRepository } from '@domain/ports/repositories/MessagerieRepository';
import type { RealtimeSocketPort } from '@domain/ports/services/RealtimeSocketPort';

export interface MarquerMessagesLusCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
  conversationId: string;
  jusquAMessageId?: string;
}

export class MarquerMessagesLusUseCase {
  constructor(
    private readonly messagerieRepository: MessagerieRepository,
    private readonly realtimeSocket?: RealtimeSocketPort,
  ) {}

  async execute(cmd: MarquerMessagesLusCommande): Promise<{ count: number }> {
    await this.messagerieRepository.verifierAppartenanceConversation({
      conversationId: cmd.conversationId,
      schoolId: cmd.schoolId,
      userId: cmd.appelantId,
      role: cmd.appelantRole,
    });

    let seuilDate: Date;
    if (cmd.jusquAMessageId) {
      const message = await this.messagerieRepository.trouverMessage(cmd.jusquAMessageId);
      if (!message || message.conversationId !== cmd.conversationId) {
        throw new Error('Message de référence introuvable dans cette conversation.');
      }
      seuilDate = message.createdAt;
    } else {
      seuilDate = new Date();
    }

    const nonLus = await this.messagerieRepository.trouverMessagesNonLus(
      cmd.conversationId,
      seuilDate,
      cmd.appelantId,
    );

    if (nonLus.length === 0) return { count: 0 };

    const count = await this.messagerieRepository.marquerMessagesLus(
      nonLus.map((m) => m.id),
      cmd.appelantId,
    );

    // Marquer également les notifications de cloche (COMMUNICATION) pour cette conversation comme lues
    await this.messagerieRepository.marquerNotificationsConversationLues({
      userId: cmd.appelantId,
      schoolId: cmd.schoolId,
      conversationId: cmd.conversationId,
    });

    if (this.realtimeSocket) {
      // Prévenir la cloche du lecteur pour réajuster immédiatement son badge non-lu
      this.realtimeSocket.emitter(`user:${cmd.appelantId}`, 'notification:conversation-read', {
        conversationId: cmd.conversationId,
      });

      if (count > 0) {
        const payload = {
          conversationId: cmd.conversationId,
          readerId: cmd.appelantId,
          readAt: new Date().toISOString(),
          messageIds: nonLus.map((m) => m.id),
        };
        this.realtimeSocket.emitter(`conversation:${cmd.conversationId}`, 'messages:read', payload);

        const participants = await this.messagerieRepository.listerParticipantsConversation(
          cmd.conversationId,
          cmd.appelantId,
        );
        for (const participantId of participants) {
          this.realtimeSocket.emitter(`user:${participantId}`, 'messages:read', payload);
        }
      }
    }

    return { count };
  }
}
