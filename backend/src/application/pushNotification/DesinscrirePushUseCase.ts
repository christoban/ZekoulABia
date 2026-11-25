import type { PushSubscriptionRepository } from '@domain/ports/repositories/PushSubscriptionRepository';

export interface DesinscrirePushCommande {
  userId: string;
  endpoint: string;
}

export class DesinscrirePushUseCase {
  constructor(private readonly pushSubscriptionRepository: PushSubscriptionRepository) {}

  async execute(commande: DesinscrirePushCommande): Promise<void> {
    await this.pushSubscriptionRepository.deleteByUserAndEndpoint(commande.userId, commande.endpoint);
  }
}
