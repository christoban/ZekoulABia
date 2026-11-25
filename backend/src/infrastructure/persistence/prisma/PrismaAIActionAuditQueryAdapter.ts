import type { PrismaClient } from '@prisma/client';
import type { AIActionAuditQueryPort, AiAction } from '@domain/ports/repositories/AIActionAuditQueryPort';

export class PrismaAIActionAuditQueryAdapter implements AIActionAuditQueryPort {
  constructor(private readonly prisma: PrismaClient) {}

  async findRecent(since: Date): Promise<AiAction[]> {
    const rows = await this.prisma.aIActionAuditLog.findMany({
      where: { timestamp: { gte: since }, outcome: 'REFUSE' },
      orderBy: { timestamp: 'desc' },
    });
    return rows as unknown as AiAction[];
  }
}
