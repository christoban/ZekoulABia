import type { PrismaClient } from '@prisma/client';
import type { PushSubscriptionRepository, PushSubscriptionData } from '@domain/ports/repositories/PushSubscriptionRepository';

export class PrismaPushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findExisting(userId: string, endpoint: string): Promise<PushSubscriptionData | null> {
    const sub = await this.prisma.pushSubscription.findFirst({ where: { userId, endpoint } });
    if (!sub) return null;
    return {
      id: sub.id,
      userId: sub.userId,
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      userAgent: sub.userAgent,
      lastSeenAt: sub.lastSeenAt,
    };
  }

  async update(id: string, data: { p256dh: string; auth: string; userAgent?: string; lastSeenAt: Date }): Promise<{ id: string }> {
    const updated = await this.prisma.pushSubscription.update({
      where: { id },
      data: {
        p256dh: data.p256dh,
        auth: data.auth,
        ...(data.userAgent !== undefined ? { userAgent: data.userAgent } : {}),
        lastSeenAt: data.lastSeenAt,
      },
    });
    return { id: updated.id };
  }

  async create(data: { userId: string; endpoint: string; p256dh: string; auth: string; userAgent?: string }): Promise<{ id: string }> {
    const created = await this.prisma.pushSubscription.create({
      data: {
        userId: data.userId,
        endpoint: data.endpoint,
        p256dh: data.p256dh,
        auth: data.auth,
        ...(data.userAgent !== undefined ? { userAgent: data.userAgent } : {}),
      },
    });
    return { id: created.id };
  }

  async deleteByUserAndEndpoint(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }

  async hasActiveToken(userId: string): Promise<boolean> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const count = await this.prisma.pushSubscription.count({
      where: { userId, lastSeenAt: { gte: thirtyDaysAgo } },
    });
    return count > 0;
  }

  async updateLastSeenAt(userId: string): Promise<void> {
    await this.prisma.pushSubscription.updateMany({
      where: { userId },
      data: { lastSeenAt: new Date() },
    });
  }
}
