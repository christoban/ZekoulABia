import type { MessagerieRepository } from '@domain/ports/repositories/MessagerieRepository';
import type { NotificationService } from '@domain/ports/services/NotificationService';

export interface ModererMessageCommande {
  schoolId: string;
  moderateurId: string;
  moderateurRole: string;
  messageId: string;
  decision: 'APPROVED' | 'REJECTED';
  motif?: string;
}

export class ModererMessageUseCase {
  constructor(
    private readonly messagerieRepository: MessagerieRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(cmd: ModererMessageCommande) {
    if (!['ADMIN', 'STAFF'].includes(cmd.moderateurRole.toUpperCase())) {
      throw new Error('Seuls Admin et Staff peuvent modérer un message.');
    }

    const message = await this.messagerieRepository.trouverMessagePourModeration(cmd.messageId, cmd.schoolId);
    if (!message) throw new Error('Message introuvable.');
    if (message.moderationStatus !== 'PENDING') {
      throw new Error('Ce message a déjà été modéré.');
    }

    const misAJour = await this.messagerieRepository.modererMessage(cmd.messageId, {
      moderationStatus: cmd.decision,
      moderatedById: cmd.moderateurId,
      moderationReason: cmd.decision === 'REJECTED' ? (cmd.motif ?? null) : null,
    });

    if (cmd.decision === 'REJECTED') {
      await this.notificationService
        .envoyer({
          schoolId: cmd.schoolId,
          userId: message.senderId,
          type: 'COMMUNICATION',
          titre: 'Message non publié',
          corps: cmd.motif ? `Votre message a été refusé : ${cmd.motif}` : 'Votre message a été refusé par la modération.',
          urgency: 'LOW',
          metadata: { conversationId: message.conversationId },
        })
        .catch(() => {});
    }

    return misAJour;
  }
}
