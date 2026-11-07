import type { TransferRequestStatus } from '@domain/ports/services/CrossSchoolTransferGatewayPort';
import type { TransferSnapshotBuildResult } from '@domain/ports/services/TransferSnapshotBuilderPort';

export interface TransferRequestRecord {
  id: string;
  identityId: string;
  sourceSchoolId: string;
  targetSchoolId: string;
  sourceStudentProfileId: string;
  targetStudentProfileId: string | null;
  requestedByUserId: string;
  academicYearTarget: string;
  status: TransferRequestStatus;
  requestedAt: Date;
  guardianDecisionAt: Date | null;
  sourceDecisionAt: Date | null;
  completedAt: Date | null;
  parentExpiresAt: Date;
  sourceAutoApprovalAt: Date | null;
  rejectionReason: string | null;
  rejectedBy: string | null;
}

export interface CreateTransferRequestCommand {
  nationalId: string;
  targetSchoolId: string;
  requestedByUserId: string;
  academicYearTarget: string;
  requestedAt: Date;
  parentExpiresAt: Date;
  sourceAutoApprovalAt: Date | null;
}

export interface TransferRequestRepositoryPort {
  findById(id: string): Promise<TransferRequestRecord | null>;
  findActiveByIdentityByNationalId(nationalId: string): Promise<TransferRequestRecord | null>;
  createPendingGuardian(command: CreateTransferRequestCommand): Promise<TransferRequestRecord>;
  listSentByTarget(targetSchoolId: string): Promise<TransferRequestRecord[]>;
  listReceivedBySource(sourceSchoolId: string): Promise<TransferRequestRecord[]>;
  transitionIfCurrent(command: {
    id: string;
    expectedStatus: TransferRequestStatus;
    nextStatus: TransferRequestStatus;
    patch?: Partial<TransferRequestRecord>;
  }): Promise<TransferRequestRecord | null>;
  completeWithSnapshot(command: {
    id: string;
    snapshot: TransferSnapshotBuildResult;
  }): Promise<TransferRequestRecord | null>;
}
