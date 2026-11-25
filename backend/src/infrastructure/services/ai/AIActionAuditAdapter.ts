import type { PrismaClient } from '@prisma/client';
import type { AIActionAuditPort } from '@domain/ports/services/AIActionAuditPort';
import { journaliserActionIA } from './AIActionAuditLogger';

export class AIActionAuditAdapter implements AIActionAuditPort {
  constructor(private readonly prisma: PrismaClient) {}

  journaliser(params: Parameters<AIActionAuditPort['journaliser']>[0]): void {
    journaliserActionIA(this.prisma, {
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      schoolId: params.schoolId,
      actionName: params.actionName,
      targetType: params.targetType,
      targetId: params.targetId,
      origin: params.origin,
      outcome: params.outcome,
      refusalReason: params.refusalReason,
      parametersSummary: params.parametersSummary,
      triggeringMessage: params.triggeringMessage,
    });
  }
}
