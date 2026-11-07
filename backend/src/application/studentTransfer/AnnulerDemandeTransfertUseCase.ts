import type { TransferRequestRepositoryPort } from '@domain/ports/repositories/TransferRequestRepository';
import type { TransferAuditPort } from '@domain/ports/services/TransferAuditPort';
import { FINAL_STATUSES } from './transferStateMachine';

export class AnnulerDemandeTransfertUseCase {
  constructor(
    private readonly repository: TransferRequestRepositoryPort,
    private readonly audit: TransferAuditPort,
  ) {}

  async execute(requestId: string, targetSchoolId: string, actorUserId: string): Promise<void> {
    const request = await this.repository.findById(requestId);
    if (!request) throw new Error('Demande de transfert introuvable.');
    if (request.targetSchoolId !== targetSchoolId) {
      throw new Error('La demande n’appartient pas à cette école cible.');
    }
    if (FINAL_STATUSES.has(request.status)) {
      throw new Error('Une demande finale ne peut pas être annulée.');
    }

    const updated = await this.repository.transitionIfCurrent({
      id: request.id,
      expectedStatus: request.status,
      nextStatus: 'CANCELLED',
    });
    if (!updated) throw new Error('La demande a déjà changé d’état.');

    await this.audit.append({
      transferRequestId: request.id,
      eventType: 'TARGET_CANCELLED',
      actorUserId,
      actorSchoolId: targetSchoolId,
      sourceSchoolId: request.sourceSchoolId,
      targetSchoolId: request.targetSchoolId,
      stateBefore: request.status,
      stateAfter: updated.status,
      metadata: {},
    });
  }
}
