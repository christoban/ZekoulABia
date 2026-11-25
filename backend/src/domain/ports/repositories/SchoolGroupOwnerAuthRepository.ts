export interface GroupOwnerAuthData {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  passwordHash: string;
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaTempSecret: string | null;
  mfaRecoveryCodeHashes: string[];
  loginEmailOtpHash: string | null;
  loginEmailOtpExpiresAt: Date | null;
  loginEmailOtpAttempts: number;
  loginEmailOtpSentAt: Date | null;
}

export interface SchoolGroupOwnerAuthRepository {
  findByEmail(email: string): Promise<GroupOwnerAuthData | null>;
  findById(ownerId: string): Promise<GroupOwnerAuthData | null>;
  getMfaStatus(ownerId: string): Promise<{ mfaEnabled: boolean }>;
  updateLoginOtp(ownerId: string, data: { loginEmailOtpHash: string; loginEmailOtpExpiresAt: Date; loginEmailOtpAttempts: number; loginEmailOtpSentAt: Date }): Promise<void>;
  incrementLoginOtpAttempts(ownerId: string): Promise<void>;
  clearLoginOtp(ownerId: string): Promise<void>;
  updateMfaRecoveryCodes(ownerId: string, hashes: string[]): Promise<void>;
  setMfaTempSecret(ownerId: string, secret: string): Promise<void>;
  activateMfa(ownerId: string, data: { mfaSecret: string; recoveryCodeHashes: string[] }): Promise<void>;
  deactivateMfa(ownerId: string): Promise<void>;
}