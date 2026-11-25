/**
 * DOMAIN LAYER — Port Repository PushSubscription
 * Persistance des abonnements push (Web Push) : souscription / désinscription.
 */

export interface PushSubscriptionData {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
  lastSeenAt: Date | null;
}

export interface PushSubscriptionRepository {
  findExisting(userId: string, endpoint: string): Promise<PushSubscriptionData | null>;
  update(id: string, data: { p256dh: string; auth: string; userAgent?: string; lastSeenAt: Date }): Promise<{ id: string }>;
  create(data: { userId: string; endpoint: string; p256dh: string; auth: string; userAgent?: string }): Promise<{ id: string }>;
  deleteByUserAndEndpoint(userId: string, endpoint: string): Promise<void>;
  hasActiveToken(userId: string): Promise<boolean>;
  updateLastSeenAt(userId: string): Promise<void>;
}
