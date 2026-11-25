import { describe, expect, it } from 'bun:test';
import type { GuardianConsentIssuerPort, TransferConsentChallenge } from '../../../../src/domain/ports/services/GuardianConsentIssuerPort.ts';
import type { TransferConsentNotificationPort } from '../../../../src/domain/ports/services/TransferConsentNotificationPort.ts';
import type { TransferAuditEventInput, TransferAuditPort } from '../../../../src/domain/ports/services/TransferAuditPort.ts';
import { RappelerConsentementTransfertUseCase } from '../../../../src/application/studentTransfer/RappelerConsentementTransfertUseCase.ts';
import { STUDENT_TRANSFER_CONFIG } from '../../../../src/application/studentTransfer/config.ts';

class RecordingIssuer implements GuardianConsentIssuerPort {
  calls: Array<{ forceResend?: boolean }> = [];

  async issueChallenge(input: { requestId: string; consentTextVersion: string; scopeAccepted: boolean; forceResend?: boolean }): Promise<TransferConsentChallenge> {
    this.calls.push({ forceResend: input.forceResend });
    return {
      requestId: input.requestId,
      consenterType: 'GUARDIAN',
      phone: '+237600000001',
      rawToken: 'token-' + this.calls.length,
      otp: '654321',
      expiresAt: new Date('2026-11-10T12:00:00.000Z'),
      notificationKey: `student-transfer-consent:${input.requestId}`,
    };
  }
}

class RecordingNotification implements TransferConsentNotificationPort {
  sent: Array<{ force?: boolean; phone: string }> = [];

  async sendChallenge(input: { phone: string; force?: boolean }): Promise<{ providerMessageId?: string }> {
    this.sent.push({ phone: input.phone, force: input.force });
    return { providerMessageId: 'sms-remind' };
  }
}

class RecordingAudit implements TransferAuditPort {
  events: Array<Partial<TransferAuditEventInput>> = [];
  async append(event: TransferAuditEventInput): Promise<void> { this.events.push(event); }
  async logDossierAccess(): Promise<void> {}
}

describe('relance du consentement parent (J+3 / J+10)', () => {
  it('régénère le lien et l’OTP, renvoie le SMS en forçant, et trace la relance', async () => {
    const issuer = new RecordingIssuer();
    const notification = new RecordingNotification();
    const audit = new RecordingAudit();
    const useCase = new RappelerConsentementTransfertUseCase(issuer, notification, audit);

    await useCase.execute({
      requestId: 'request-a',
      sourceSchoolId: 'school-a',
      targetSchoolId: 'school-b',
      day: 3,
    });

    expect(issuer.calls).toEqual([{ forceResend: true }]);
    expect(notification.sent).toEqual([{ phone: '+237600000001', force: true }]);
    expect(audit.events).toHaveLength(1);
    expect(audit.events[0]?.eventType).toBe('GUARDIAN_CONSENT_REMINDER');
    expect(audit.events[0]?.metadata).toEqual({ day: 3 });
    expect((audit.events[0] as TransferAuditEventInput).sourceSchoolId).toBe('school-a');
  });

  it('utilise la version de texte de consentement pilotée par la config', async () => {
    expect(STUDENT_TRANSFER_CONFIG.consentTextVersion).toBe('student-transfer-v1');
    expect(STUDENT_TRANSFER_CONFIG.consentLinkTtlHours).toBe(48);
  });
});
