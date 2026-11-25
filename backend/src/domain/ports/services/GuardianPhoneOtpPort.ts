export interface GuardianPhoneOtpPort {
  /** Génère un OTP 6 chiffres hashé en base et l'envoie par SMS au tuteur principal. */
  envoyerOtpTelephone(command: {
    studentProfileId: string;
    schoolId: string;
    now?: Date;
  }): Promise<{ expiresAt: Date }>;

  /** Vérifie l'OTP, marque le téléphone vérifié et purge le challenge. */
  verifierOtpTelephone(command: {
    studentProfileId: string;
    schoolId: string;
    otp: string;
    now?: Date;
  }): Promise<void>;
}
