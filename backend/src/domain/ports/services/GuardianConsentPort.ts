export type TransferConsentDecision = 'ACCEPT' | 'REFUSE';

export interface VerifiedTransferConsent {
  requestId: string;
  consenterType: 'GUARDIAN' | 'ADULT_STUDENT';
  consenterRef: string;
  channel: 'LINK_OTP' | 'ASSISTED_BY_STAFF';
  consentTextVersion: string;
  scopeAccepted: boolean;
  ipAddress: string | null;
}

export interface GuardianConsentPort {
  verifyAndConsume(input: {
    token: string;
    otp: string;
    decision: TransferConsentDecision;
    channel: 'LINK_OTP' | 'ASSISTED_BY_STAFF';
  }): Promise<VerifiedTransferConsent>;

  /**
   * Vérifie que le jeton appartient bien à la demande, sans le consommer,
   * puis marque le consentement REFUSED/REVOKED côté tuteur.
   */
  revokeIfHolder(input: {
    token: string;
    requestId: string;
  }): Promise<Pick<VerifiedTransferConsent, 'consenterType' | 'consenterRef'> | null>;
}
