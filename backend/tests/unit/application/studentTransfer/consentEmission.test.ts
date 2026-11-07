import { describe, expect, it } from 'bun:test';
import type { GuardianConsentIssuerPort, TransferConsentChallenge } from '../../../../src/domain/ports/services/GuardianConsentIssuerPort.ts';
import type { TransferConsentNotificationPort } from '../../../../src/domain/ports/services/TransferConsentNotificationPort.ts';
import { EmettreConsentementTransfertUseCase } from '../../../../src/application/studentTransfer/EmettreConsentementTransfertUseCase.ts';

const challenge: TransferConsentChallenge = {
  requestId: 'request-a',
  consenterType: 'GUARDIAN',
  phone: '+237600000001',
  rawToken: 'token',
  otp: '123456',
  expiresAt: new Date('2026-11-08T12:00:00.000Z'),
  notificationKey: 'student-transfer-consent:request-a',
};

class FakeIssuer implements GuardianConsentIssuerPort {
  async issueChallenge(): Promise<TransferConsentChallenge> { return challenge; }
}

class FakeNotification implements TransferConsentNotificationPort {
  sent: TransferConsentChallenge | null = null;
  async sendChallenge(input: TransferConsentChallenge): Promise<{ providerMessageId?: string }> {
    this.sent = input;
    return { providerMessageId: 'sms-1' };
  }
}

describe('émission du consentement transfert', () => {
  it('génère le challenge puis envoie le lien et l’OTP au même destinataire', async () => {
    const notification = new FakeNotification();
    const result = await new EmettreConsentementTransfertUseCase(new FakeIssuer(), notification).execute({
      requestId: 'request-a', consentTextVersion: 'v1', scopeAccepted: true,
    });
    expect(result.expiresAt).toEqual(challenge.expiresAt);
    expect(notification.sent).toEqual(challenge);
  });
});
