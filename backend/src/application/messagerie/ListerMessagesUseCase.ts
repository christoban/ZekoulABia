import type { MessagerieRepository } from '@domain/ports/repositories/MessagerieRepository';

const TAILLE_PAGE = 30;
const TAILLE_RATTRAPAGE_MAX = 200;

export interface ListerMessagesCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
  conversationId: string;
  page?: number;
  since?: Date;
}

export class ListerMessagesUseCase {
  constructor(private readonly messagerieRepository: MessagerieRepository) {}

  async execute(cmd: ListerMessagesCommande) {
    await this.messagerieRepository.verifierAppartenanceConversation({
      conversationId: cmd.conversationId,
      schoolId: cmd.schoolId,
      userId: cmd.appelantId,
      role: cmd.appelantRole,
    });

    const role = cmd.appelantRole.toUpperCase();
    const estSupervision = role === 'ADMIN' || role === 'STAFF';

    const page = Math.max(1, cmd.page ?? 1);
    return this.messagerieRepository.listerMessagesPourConversation({
      conversationId: cmd.conversationId,
      estSupervision,
      appelantId: cmd.appelantId,
      since: cmd.since,
      page,
    });
  }
}
