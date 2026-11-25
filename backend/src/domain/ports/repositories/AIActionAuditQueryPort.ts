export interface AiAction {
  actorUserId: string;
  actorRole: string;
  schoolId: string | null;
  actionName: string;
  origin: string;
  refusalReason: string | null;
  timestamp: Date;
}

export interface AIActionAuditQueryPort {
  findRecent(since: Date): Promise<AiAction[]>;
}
