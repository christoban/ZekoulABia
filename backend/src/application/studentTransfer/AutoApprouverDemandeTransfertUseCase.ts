import type { TransferRequestRepositoryPort } from '@domain/ports/repositories/TransferRequestRepository';
import type { TransferAuditPort } from '@domain/ports/services/TransferAuditPort';

export class AutoApprouverDemandeTransfertUseCase {
  constructor(
    private readonly repository: TransferRequestRepositoryPort,
    private readonly audit: TransferAuditPort,
  ) {}

  async execute(requestId: string, now = new Date()): Promise<boolean> {
    const request = await this.repository.findById(requestId);
    if (!request || request.status !== 'PENDING_SOURCE' || !request.sourceAutoApprovalAt) return false;
    if (request.sourceAutoApprovalAt > now) return false;

    const updated = await this.repository.transitionIfCurrent({
      id: request.id,
      expectedStatus: 'PENDING_SOURCE',
      nextStatus: 'APPROVED',
      patch: { sourceAutoApprovalAt: now, sourceDecisionAt: now },
    });
    if (!updated) return false;

    await this.audit.append({
      transferRequestId: request.id,
      eventType: 'SOURCE_AUTO_APPROVED',
      actorSchoolId: request.sourceSchoolId,
      sourceSchoolId: request.sourceSchoolId,
      targetSchoolId: request.targetSchoolId,
      stateBefore: request.status,
      stateAfter: updated.status,
      metadata: { automatic: true },
    });
    return true;
  }
}
