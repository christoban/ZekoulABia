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

/**
 * Source unique du choix du jour de relance (J+3 / J+10) : 10 prime s'il est
 * déjà atteint, une relance déjà journalisée à ce jour n'est jamais rejouée
 * (idempotence des jobs — déduplication par l'événement d'audit `day`), et une
 * J+10 déjà envoyée interdit toute relance J+3 rétroactive.
 */
export function choisirJourRelance(
  joursDepuisDemande: number,
  dejaFait3: boolean,
  dejaFait10: boolean,
): 3 | 10 | null {
  if (joursDepuisDemande >= 10) return dejaFait10 ? null : 10;
  if (joursDepuisDemande >= 3) return dejaFait3 ? null : 3;
  return null;
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
