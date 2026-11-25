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

/** Vue cible utilisée par l'écran « Historique d'avant transfert » (TRANSFER_DOSSIER_VIEW). */
export interface CompletedTransferBrief {
  id: string;
  completedAt: Date | null;
  sourceSchoolName: string;
  snapshotId: string | null;
  targetStudentProfileId: string | null;
}

/** Liste de l'école cible — l'école d'origine est nommée pour l'affichage. */
export interface TargetSentBrief extends TransferRequestRecord {
  sourceSchoolName: string;
}

/** Liste de l'école d'origine — l'école cible est nommée pour l'affichage. */
export interface SourceReceivedBrief extends TransferRequestRecord {
  targetSchoolName: string;
  /** Dernier challenge de consentement connu pour l'écran admin (état du tuteur). */
  consenterDecision: 'PENDING' | 'ACCEPTED' | 'REFUSED' | 'REVOKED' | null;
  consenterExpiresAt: Date | null;
}

export interface TransferRequestRepositoryPort {
  findById(id: string): Promise<TransferRequestRecord | null>;
  findActiveByIdentityByNationalId(nationalId: string): Promise<TransferRequestRecord | null>;
  createPendingGuardian(command: CreateTransferRequestCommand): Promise<TransferRequestRecord>;
  listSentByTarget(targetSchoolId: string): Promise<TargetSentBrief[]>;
  listReceivedBySource(sourceSchoolId: string): Promise<SourceReceivedBrief[]>;
  /** Demandes COMPLETED dont cette école est la cible — arrière-plan du bloc Censeur/Conseiller B. */
  listCompletedForTargetSchool(targetSchoolId: string): Promise<CompletedTransferBrief[]>;
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
