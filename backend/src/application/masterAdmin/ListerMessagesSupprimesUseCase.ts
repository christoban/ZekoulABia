import type { SuppressedOutboundMessageEntry, SuppressedOutboundMessageRepository } from '@domain/ports/repositories/SuppressedOutboundMessageRepository';

const LIMITE_DEFAUT = 100;

export class ListerMessagesSupprimesUseCase {
  constructor(private readonly depot: SuppressedOutboundMessageRepository) {}

  async execute(limite?: number, schoolId?: string | null): Promise<SuppressedOutboundMessageEntry[]> {
    const limiteEffective = typeof limite === 'number' && Number.isFinite(limite) && limite > 0
      ? Math.min(Math.floor(limite), 500)
      : LIMITE_DEFAUT;
    const filtreEcole = typeof schoolId === 'string' && schoolId.trim().length > 0 ? schoolId.trim() : null;
    return this.depot.lister(limiteEffective, filtreEcole);
  }
}
