export interface TransferAuditEventInput {
  transferRequestId: string;
  eventType: string;
  actorUserId?: string;
  actorSchoolId: string;
  sourceSchoolId: string;
  targetSchoolId: string;
  stateBefore: string;
  stateAfter: string;
  metadata: Record<string, unknown>;
}

export interface TransferAuditPort {
  append(event: TransferAuditEventInput): Promise<void>;
  logDossierAccess(input: {
    snapshotId: string;
    transferRequestId: string;
    userId: string;
    schoolId: string;
  }): Promise<void>;
}
