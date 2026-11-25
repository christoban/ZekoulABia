import type { GuardianConsentIssuerPort } from '@domain/ports/services/GuardianConsentIssuerPort';
import type { TransferConsentNotificationPort } from '@domain/ports/services/TransferConsentNotificationPort';

export class EmettreConsentementTransfertUseCase {
  constructor(
    private readonly issuer: GuardianConsentIssuerPort,
    private readonly notification: TransferConsentNotificationPort,
  ) {}

  async execute(input: {
    requestId: string;
    consentTextVersion: string;
    scopeAccepted: boolean;
    now?: Date;
  }): Promise<{ expiresAt: Date }> {
    const challenge = await this.issuer.issueChallenge(input);
    await this.notification.sendChallenge(challenge);
    return { expiresAt: challenge.expiresAt };
  }
}
