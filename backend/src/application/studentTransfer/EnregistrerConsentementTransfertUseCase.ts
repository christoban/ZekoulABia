import type { TransferRequestRepositoryPort } from '@domain/ports/repositories/TransferRequestRepository';
import type { TransferAuditPort } from '@domain/ports/services/TransferAuditPort';
import type { GuardianConsentPort, TransferConsentDecision } from '@domain/ports/services/GuardianConsentPort';
import { STUDENT_TRANSFER_CONFIG } from './config';

export interface EnregistrerConsentementTransfertCommand {
  requestId: string;
  token: string;
  otp: string;
  decision?: TransferConsentDecision;
  channel?: 'LINK_OTP' | 'ASSISTED_BY_STAFF';
}

export class EnregistrerConsentementTransfertUseCase {
  constructor(
    private readonly repository: TransferRequestRepositoryPort,
    private readonly consent: GuardianConsentPort,
    private readonly audit: TransferAuditPort,
  ) {}

  async execute(command: EnregistrerConsentementTransfertCommand): Promise<void> {
    const request = await this.repository.findById(command.requestId);
    if (!request) throw new Error('Demande de transfert introuvable.');
    if (request.status !== 'PENDING_GUARDIAN') {
      throw new Error('Le consentement est impossible hors de PENDING_GUARDIAN.');
    }

    const decision = command.decision ?? 'ACCEPT';
    const channel = command.channel ?? 'LINK_OTP';
    const verified = await this.consent.verifyAndConsume({
      token: command.token,
      otp: command.otp,
      decision,
      channel,
    });
    if (verified.requestId !== request.id) {
      throw new Error('Le lien de consentement ne correspond pas à la demande.');
    }

    if (decision === 'ACCEPT' && !verified.scopeAccepted) {
      throw new Error('Le périmètre du consentement doit être accepté.');
    }

    const nextStatus = decision === 'ACCEPT' ? 'PENDING_SOURCE' : 'REFUSED_BY_GUARDIAN';
    const sourceAutoApprovalAt = new Date();
    sourceAutoApprovalAt.setUTCDate(
      sourceAutoApprovalAt.getUTCDate() + STUDENT_TRANSFER_CONFIG.sourceAutoApprovalDelayDays,
    );
    const updated = await this.repository.transitionIfCurrent({
      id: request.id,
      expectedStatus: 'PENDING_GUARDIAN',
      nextStatus,
      patch: {
        guardianDecisionAt: new Date(),
        ...(decision === 'ACCEPT' ? { sourceAutoApprovalAt } : {}),
      },
    });
    if (!updated) throw new Error('La demande a déjà changé d’état.');

    await this.audit.append({
      transferRequestId: request.id,
      eventType: decision === 'ACCEPT' ? 'GUARDIAN_CONSENT_ACCEPTED' : 'GUARDIAN_CONSENT_REFUSED',
      actorSchoolId: request.sourceSchoolId,
      sourceSchoolId: request.sourceSchoolId,
      targetSchoolId: request.targetSchoolId,
      stateBefore: request.status,
      stateAfter: updated.status,
      metadata: {
        consenterType: verified.consenterType,
        channel: verified.channel,
        consentTextVersion: verified.consentTextVersion,
      },
    });
  }
}
