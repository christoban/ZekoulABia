import type { PushSubscriptionRepository } from '@domain/ports/repositories/PushSubscriptionRepository';

export interface SouscrirePushCommande {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
}

export class SouscrirePushUseCase {
  constructor(private readonly pushSubscriptionRepository: PushSubscriptionRepository) {}

  async execute(commande: SouscrirePushCommande): Promise<{ id: string }> {
    const existing = await this.pushSubscriptionRepository.findExisting(commande.userId, commande.endpoint);

    if (existing) {
      return this.pushSubscriptionRepository.update(existing.id, {
        p256dh: commande.p256dh,
        auth: commande.auth,
        ...(commande.userAgent !== undefined ? { userAgent: commande.userAgent } : { userAgent: existing.userAgent ?? undefined }),
        lastSeenAt: new Date(),
      });
    }

    return this.pushSubscriptionRepository.create({
      userId: commande.userId,
      endpoint: commande.endpoint,
      p256dh: commande.p256dh,
      auth: commande.auth,
      ...(commande.userAgent !== undefined ? { userAgent: commande.userAgent } : {}),
    });
  }
}
