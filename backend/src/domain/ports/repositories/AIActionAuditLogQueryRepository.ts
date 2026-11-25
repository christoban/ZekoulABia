/**
 * DOMAIN LAYER — Port de lecture dédié au journal d'audit des actions IA
 * (AIActionAuditController, vue "Journal d'établissement").
 *
 * Lecture seule — jamais d'écriture. Existe pour ne pas injecter PrismaClient
 * dans le controller (cohérence hexagonale). Le scoping schoolId est toujours
 * fourni par l'appelant (jamais déduit d'un paramètre client).
 */

export interface AIActionAuditLogRow {
  id: string;
  timestamp: Date;
  actorUserId: string;
  actorRole: string;
  schoolId: string | null;
  actionName: string;
  targetType: string | null;
  targetId: string | null;
  origin: string;
  outcome: string;
  refusalReason: string | null;
  parametersSummary: unknown | null;
  triggeringMessage: string | null;
}

export interface AIActionAuditLogListInput {
  schoolId: string | null;
  outcome?: string;
  origin?: string;
  actorRole?: string;
  actionName?: string;
  skip: number;
  limit: number;
}

export interface AIActionAuditLogQueryRepository {
  listBySchool(input: AIActionAuditLogListInput): Promise<{ logs: AIActionAuditLogRow[]; total: number }>;
}
