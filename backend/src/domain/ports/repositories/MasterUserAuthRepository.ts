export interface MasterUserAuthData {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  isSuperAdmin: boolean;
  passwordHash: string;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaTempSecret: string | null;
  mfaRecoveryCodeHashes: string[];
  loginEmailOtpHash: string | null;
  loginEmailOtpExpiresAt: Date | null;
  loginEmailOtpAttempts: number;
  loginEmailOtpSentAt: Date | null;
  passwordChangeEmailOtpHash: string | null;
  passwordChangeEmailOtpExpiresAt: Date | null;
  passwordChangeEmailOtpAttempts: number;
  passwordChangeEmailOtpSentAt: Date | null;
}

export interface MasterUserAuthRepository {
  findByEmail(email: string): Promise<MasterUserAuthData | null>;
  findById(masterUserId: string): Promise<MasterUserAuthData | null>;
  getMfaStatus(masterUserId: string): Promise<{ mfaEnabled: boolean }>;
  updateLoginOtp(masterUserId: string, data: {
    loginEmailOtpHash: string; loginEmailOtpExpiresAt: Date; loginEmailOtpAttempts: number; loginEmailOtpSentAt: Date;
  }): Promise<void>;
  incrementLoginOtpAttempts(masterUserId: string): Promise<void>;
  clearLoginOtp(masterUserId: string): Promise<void>;
  updatePasswordChangeOtp(masterUserId: string, data: {
    passwordChangeEmailOtpHash: string; passwordChangeEmailOtpExpiresAt: Date; passwordChangeEmailOtpAttempts: number; passwordChangeEmailOtpSentAt: Date;
  }): Promise<void>;
  incrementPasswordChangeOtpAttempts(masterUserId: string): Promise<void>;
  /** Applique le nouveau mot de passe ET efface l'OTP password-change en une écriture. */
  applyPasswordChange(masterUserId: string, passwordHash: string): Promise<void>;
  updateMfaRecoveryCodes(masterUserId: string, hashes: string[]): Promise<void>;
  setMfaTempSecret(masterUserId: string, secret: string): Promise<void>;
  activateMfa(masterUserId: string, data: { mfaSecret: string; recoveryCodeHashes: string[] }): Promise<void>;
  deactivateMfa(masterUserId: string): Promise<void>;
}
