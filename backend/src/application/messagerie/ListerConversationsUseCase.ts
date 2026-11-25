import type { MessagerieRepository } from '@domain/ports/repositories/MessagerieRepository';

export interface ListerConversationsCommande {
  schoolId: string;
  appelantId: string;
  appelantRole: string;
}

export class ListerConversationsUseCase {
  constructor(private readonly messagerieRepository: MessagerieRepository) {}

  async execute(cmd: ListerConversationsCommande) {
    const role = cmd.appelantRole.toUpperCase();
    const estSupervision = role === 'ADMIN' || role === 'STAFF';

    const classIds = estSupervision ? [] : await this.messagerieRepository.classIdsPertinents(cmd.appelantId, role);

    return this.messagerieRepository.listerConversationsPourAppelant({
      schoolId: cmd.schoolId,
      appelantId: cmd.appelantId,
      role,
      classIds,
      estSupervision,
    });
  }
}
