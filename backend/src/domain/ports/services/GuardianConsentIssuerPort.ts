export interface TransferConsentChallenge {
  requestId: string;
  consenterType: 'GUARDIAN' | 'ADULT_STUDENT';
  phone: string;
  rawToken: string;
  otp: string;
  expiresAt: Date;
  notificationKey: string;
}

export interface GuardianConsentIssuerPort {
  issueChallenge(input: {
    requestId: string;
    consentTextVersion: string;
    scopeAccepted: boolean;
    /** Relance : régénère le lien/OTP même si un SMS est déjà parti. */
    forceResend?: boolean;
    now?: Date;
  }): Promise<TransferConsentChallenge>;
}
