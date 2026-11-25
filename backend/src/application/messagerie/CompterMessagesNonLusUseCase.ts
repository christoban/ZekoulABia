import type { MessagerieRepository } from '@domain/ports/repositories/MessagerieRepository';

export interface CompterMessagesNonLusCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
}

/**
 * Total agrégé de messages non lus, tous canaux confondus — alimente le badge de la sidebar
 * (distinct du compteur par conversation déjà renvoyé par ListerConversationsUseCase, qui sert
 * à l'affichage détaillé dans la liste elle-même).
 */
export class CompterMessagesNonLusUseCase {
  constructor(private readonly messagerieRepository: MessagerieRepository) {}

  async execute(cmd: CompterMessagesNonLusCommande): Promise<{ count: number }> {
    const role = cmd.appelantRole.toUpperCase();
    const estSupervision = role === 'ADMIN' || role === 'STAFF';
    const classIds = estSupervision ? [] : await this.messagerieRepository.classIdsPertinents(cmd.appelantId, role);

    const conversationWhere: Record<string, unknown> = {
      schoolId: cmd.schoolId,
      OR: [
        { type: 'PRIVATE', participants: { some: { userId: cmd.appelantId } } },
        estSupervision
          ? { type: { in: ['CLASS_CHANNEL', 'PARENT_CHANNEL'] } }
          : {
              OR: [
                ...(classIds.length && (role === 'TEACHER' || role === 'STUDENT') ? [{ type: 'CLASS_CHANNEL', classId: { in: classIds } }] : []),
                ...(classIds.length && (role === 'TEACHER' || role === 'PARENT') ? [{ type: 'PARENT_CHANNEL', classId: { in: classIds } }] : []),
              ],
            },
      ],
    };

    const count = await this.messagerieRepository.compterMessagesNonLus({
      senderId: { not: cmd.appelantId },
      moderationStatus: 'APPROVED',
      readStatuses: { none: { userId: cmd.appelantId } },
      conversation: conversationWhere,
    });

    return { count };
  }
}
