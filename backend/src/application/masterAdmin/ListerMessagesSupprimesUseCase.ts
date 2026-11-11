import type { SuppressedOutboundMessageEntry, SuppressedOutboundMessageRepository } from '@domain/ports/repositories/SuppressedOutboundMessageRepository';

const LIMITE_DEFAUT = 100;

export class ListerMessagesSupprimesUseCase {
  constructor(private readonly depot: SuppressedOutboundMessageRepository) {}

  async execute(limite?: number): Promise<SuppressedOutboundMessageEntry[]> {
    const limiteEffective = typeof limite === 'number' && Number.isFinite(limite) && limite > 0
      ? Math.min(Math.floor(limite), 500)
      : LIMITE_DEFAUT;
    return this.depot.lister(limiteEffective);
  }
}
