import type { TransferRequestRepositoryPort } from '@domain/ports/repositories/TransferRequestRepository';
import type { TransferAuditPort } from '@domain/ports/services/TransferAuditPort';

export class ExpirerDemandeTransfertUseCase {
  constructor(
    private readonly repository: TransferRequestRepositoryPort,
    private readonly audit: TransferAuditPort,
  ) {}

  async execute(requestId: string, now = new Date()): Promise<boolean> {
    const request = await this.repository.findById(requestId);
    if (!request || request.status !== 'PENDING_GUARDIAN' || request.parentExpiresAt > now) return false;

    const updated = await this.repository.transitionIfCurrent({
      id: request.id,
      expectedStatus: 'PENDING_GUARDIAN',
      nextStatus: 'EXPIRED',
    });
    if (!updated) return false;

    await this.audit.append({
      transferRequestId: request.id,
      eventType: 'GUARDIAN_CONSENT_EXPIRED',
      actorSchoolId: request.targetSchoolId,
      sourceSchoolId: request.sourceSchoolId,
      targetSchoolId: request.targetSchoolId,
      stateBefore: request.status,
      stateAfter: updated.status,
      metadata: {},
    });
    return true;
  }
}
