export interface TransferConsentNotificationPort {
  sendChallenge(input: {
    phone: string;
    rawToken: string;
    otp: string;
    requestId: string;
    expiresAt: Date;
    notificationKey: string;
    /** Relance : ignore le garde-fou « déjà envoyé ». */
    force?: boolean;
  }): Promise<{ providerMessageId?: string }>;
}
