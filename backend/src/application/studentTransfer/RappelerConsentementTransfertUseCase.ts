import type { GuardianConsentIssuerPort } from '@domain/ports/services/GuardianConsentIssuerPort';
import type { TransferConsentNotificationPort } from '@domain/ports/services/TransferConsentNotificationPort';
import type { TransferAuditPort } from '@domain/ports/services/TransferAuditPort';
import { STUDENT_TRANSFER_CONFIG } from './config';

export interface RappelerConsentementTransfertCommand {
  requestId: string;
  sourceSchoolId: string;
  targetSchoolId: string;
  day: 3 | 10;
  now?: Date;
}

/** Relance J+3 / J+10 : régénère le lien + OTP (même notificationKey) puis renvoie le SMS. */
export class RappelerConsentementTransfertUseCase {
  constructor(
    private readonly issuer: GuardianConsentIssuerPort,
    private readonly notification: TransferConsentNotificationPort,
    private readonly audit: TransferAuditPort,
  ) {}

  async execute(command: RappelerConsentementTransfertCommand): Promise<void> {
    const challenge = await this.issuer.issueChallenge({
      requestId: command.requestId,
      consentTextVersion: STUDENT_TRANSFER_CONFIG.consentTextVersion,
      scopeAccepted: true,
      forceResend: true,
      now: command.now,
    });
    await this.notification.sendChallenge({ ...challenge, force: true });

    await this.audit.append({
      transferRequestId: command.requestId,
      eventType: 'GUARDIAN_CONSENT_REMINDER',
      actorSchoolId: command.targetSchoolId,
      sourceSchoolId: command.sourceSchoolId,
      targetSchoolId: command.targetSchoolId,
      stateBefore: 'PENDING_GUARDIAN',
      stateAfter: 'PENDING_GUARDIAN',
      metadata: { day: command.day },
    });
  }
}
