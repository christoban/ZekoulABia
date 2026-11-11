import type { PrismaClient } from '@prisma/client';
import type {
  SuppressedOutboundMessageEntry,
  SuppressedOutboundMessageRepository,
} from '@domain/ports/repositories/SuppressedOutboundMessageRepository';

const RETENTION_JOURS = 7;

export class PrismaSuppressedOutboundMessageRepository implements SuppressedOutboundMessageRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async enregistrer(params: {
    channel: string;
    eventType: string;
    recipientMasked: string;
    schoolId?: string | null;
  }): Promise<void> {
    await this.prisma.suppressedOutboundMessage.create({
      data: {
        channel: params.channel,
        eventType: params.eventType,
        recipientMasked: params.recipientMasked,
        schoolId: params.schoolId ?? null,
      },
    });
    // Purge opportuniste de la rétention 7 jours — évite un job dédié.
    await this.prisma.suppressedOutboundMessage.deleteMany({
      where: { createdAt: { lt: new Date(Date.now() - RETENTION_JOURS * 24 * 60 * 60 * 1000) } },
    });
  }

  async lister(limit: number, schoolId?: string | null): Promise<SuppressedOutboundMessageEntry[]> {
    return this.prisma.suppressedOutboundMessage.findMany({
      where: schoolId ? { schoolId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        channel: true,
        eventType: true,
        recipientMasked: true,
        schoolId: true,
        createdAt: true,
      },
    });
  }
}
