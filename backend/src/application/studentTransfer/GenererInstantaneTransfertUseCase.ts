import type { TransferRequestRepositoryPort } from '@domain/ports/repositories/TransferRequestRepository';
import type { TransferAuditPort } from '@domain/ports/services/TransferAuditPort';
import type {
  TransferSnapshotBuildResult,
  TransferSnapshotBuilderPort,
} from '@domain/ports/services/TransferSnapshotBuilderPort';

export class GenererInstantaneTransfertUseCase {
  constructor(
    private readonly repository: TransferRequestRepositoryPort,
    private readonly snapshotBuilder: TransferSnapshotBuilderPort,
    private readonly audit: TransferAuditPort,
  ) {}

  async execute(requestId: string): Promise<TransferSnapshotBuildResult> {
    const request = await this.repository.findById(requestId);
    if (!request) throw new Error('Demande de transfert introuvable.');
    if (request.status !== 'APPROVED') {
      throw new Error('Un instantané ne peut être généré que pour une demande APPROVED.');
    }

    const snapshot = await this.snapshotBuilder.buildApprovedSnapshot({
      transferRequestId: request.id,
      sourceSchoolId: request.sourceSchoolId,
      targetSchoolId: request.targetSchoolId,
      sourceStudentProfileId: request.sourceStudentProfileId,
    });
    const completed = await this.repository.completeWithSnapshot({
      id: request.id,
      snapshot,
    });
    if (!completed) throw new Error('La demande a déjà changé d’état.');

    await this.audit.append({
      transferRequestId: request.id,
      eventType: 'SNAPSHOT_GENERATED',
      actorSchoolId: request.sourceSchoolId,
      sourceSchoolId: request.sourceSchoolId,
      targetSchoolId: request.targetSchoolId,
      stateBefore: request.status,
      stateAfter: completed.status,
      metadata: { snapshotId: snapshot.snapshotId, checksum: snapshot.checksum },
    });
    return snapshot;
  }
}
