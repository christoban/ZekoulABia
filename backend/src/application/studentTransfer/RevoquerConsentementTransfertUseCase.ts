import type { TransferRequestRepositoryPort } from '@domain/ports/repositories/TransferRequestRepository';
import type { TransferAuditPort } from '@domain/ports/services/TransferAuditPort';
import type { GuardianConsentPort } from '@domain/ports/services/GuardianConsentPort';
import { TRANSFER_REQUEST_FINAL_STATUSES } from '@domain/ports/services/CrossSchoolTransferGatewayPort';

export interface RevoquerConsentementTransfertCommand {
  requestId: string;
  /** Jeton du lien reçu par SMS : se détenteur du seul messenger peut révoquer. */
  token: string;
}

export class RevoquerConsentementTransfertUseCase {
  constructor(
    private readonly repository: TransferRequestRepositoryPort,
    private readonly consent: GuardianConsentPort,
    private readonly audit: TransferAuditPort,
  ) {}

  async execute(command: RevoquerConsentementTransfertCommand): Promise<void> {
    const request = await this.repository.findById(command.requestId);
    if (!request) throw new Error('Demande de transfert introuvable.');
    if (TRANSFER_REQUEST_FINAL_STATUSES.includes(request.status)) {
      throw new Error('La révocation est impossible dans un état final.');
    }

    const revoked = await this.consent.revokeIfHolder({
      token: command.token,
      requestId: request.id,
    });
    if (!revoked) throw new Error('Lien de consentement invalide pour cette demande.');

    const updated = await this.repository.transitionIfCurrent({
      id: request.id,
      expectedStatus: request.status,
      nextStatus: 'REVOKED',
      patch: { guardianDecisionAt: new Date() },
    });
    if (!updated) throw new Error('La demande a déjà changé d’état.');

    await this.audit.append({
      transferRequestId: request.id,
      eventType: 'GUARDIAN_CONSENT_REVOKED',
      actorSchoolId: request.sourceSchoolId,
      sourceSchoolId: request.sourceSchoolId,
      targetSchoolId: request.targetSchoolId,
      stateBefore: request.status,
      stateAfter: updated.status,
      metadata: { consenterType: revoked.consenterType, consenterRef: revoked.consenterRef },
    });
  }
}
