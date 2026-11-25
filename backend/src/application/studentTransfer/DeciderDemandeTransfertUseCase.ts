import type { TransferRequestRepositoryPort } from '@domain/ports/repositories/TransferRequestRepository';
import type { TransferAuditPort } from '@domain/ports/services/TransferAuditPort';

export interface DeciderDemandeTransfertCommand {
  requestId: string;
  sourceSchoolId: string;
  actorUserId: string;
  decision: 'APPROVE' | 'REFUSE';
  rejectionReason?: string;
}

export class DeciderDemandeTransfertUseCase {
  constructor(
    private readonly repository: TransferRequestRepositoryPort,
    private readonly audit: TransferAuditPort,
  ) {}

  async execute(command: DeciderDemandeTransfertCommand): Promise<void> {
    const request = await this.repository.findById(command.requestId);
    if (!request) throw new Error('Demande de transfert introuvable.');
    if (request.sourceSchoolId !== command.sourceSchoolId) {
      throw new Error('La demande n’appartient pas à cette école source.');
    }
    if (request.status !== 'PENDING_SOURCE') {
      throw new Error('La décision source est possible uniquement en PENDING_SOURCE.');
    }
    if (command.decision === 'REFUSE' && !command.rejectionReason?.trim()) {
      throw new Error('Un motif est obligatoire pour refuser une demande.');
    }

    const nextStatus = command.decision === 'APPROVE' ? 'APPROVED' : 'REFUSED_BY_SOURCE';
    const updated = await this.repository.transitionIfCurrent({
      id: request.id,
      expectedStatus: 'PENDING_SOURCE',
      nextStatus,
      patch: {
        sourceDecisionAt: new Date(),
        ...(command.decision === 'REFUSE'
          ? { rejectionReason: command.rejectionReason, rejectedBy: command.actorUserId }
          : {}),
      },
    });
    if (!updated) throw new Error('La demande a déjà changé d’état.');

    await this.audit.append({
      transferRequestId: request.id,
      eventType: command.decision === 'APPROVE' ? 'SOURCE_APPROVED' : 'SOURCE_REFUSED',
      actorUserId: command.actorUserId,
      actorSchoolId: command.sourceSchoolId,
      sourceSchoolId: request.sourceSchoolId,
      targetSchoolId: request.targetSchoolId,
      stateBefore: request.status,
      stateAfter: updated.status,
      metadata: command.decision === 'REFUSE' ? { rejectionReason: command.rejectionReason } : {},
    });
  }
}
