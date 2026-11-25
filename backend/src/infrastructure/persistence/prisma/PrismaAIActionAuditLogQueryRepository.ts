/**
 * INFRASTRUCTURE — Adapter Prisma pour AIActionAuditLogQueryRepository.
 * Reprend EXACTEMENT la requête du controller avant extraction (mêmes where,
 * mêmes args) : journal paginé, toujours scopé sur schoolId.
 */
import type { PrismaClient } from '@prisma/client';
import type {
  AIActionAuditLogQueryRepository,
  AIActionAuditLogRow,
  AIActionAuditLogListInput,
} from '@domain/ports/repositories/AIActionAuditLogQueryRepository';

export class PrismaAIActionAuditLogQueryRepository implements AIActionAuditLogQueryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listBySchool(input: AIActionAuditLogListInput): Promise<{ logs: AIActionAuditLogRow[]; total: number }> {
    const where = this.buildWhere(input);
    const [total, logs] = await Promise.all([
      this.prisma.aIActionAuditLog.count({ where }),
      this.prisma.aIActionAuditLog.findMany({
        where,
        orderBy: { timestamp: 'desc' },
        skip: input.skip,
        take: input.limit,
      }),
    ]);
    return { logs: logs as AIActionAuditLogRow[], total };
  }

  private buildWhere(input: AIActionAuditLogListInput): Record<string, unknown> {
    return {
      schoolId: input.schoolId,
      ...(input.outcome ? { outcome: input.outcome } : {}),
      ...(input.origin ? { origin: input.origin } : {}),
      ...(input.actorRole ? { actorRole: input.actorRole } : {}),
      ...(input.actionName ? { actionName: input.actionName } : {}),
    };
  }
}
