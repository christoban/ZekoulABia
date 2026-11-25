import type { PrismaClient } from '@prisma/client';
import type { MasterUserAuthRepository, MasterUserAuthData } from '@domain/ports/repositories/MasterUserAuthRepository';

export class PrismaMasterUserAuthRepository implements MasterUserAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<MasterUserAuthData | null> {
    return this.prisma.masterUser.findUnique({ where: { email } }) as Promise<MasterUserAuthData | null>;
  }

  async findById(masterUserId: string): Promise<MasterUserAuthData | null> {
    return this.prisma.masterUser.findUnique({ where: { id: masterUserId } }) as Promise<MasterUserAuthData | null>;
  }

  async getMfaStatus(masterUserId: string): Promise<{ mfaEnabled: boolean }> {
    const user = await this.prisma.masterUser.findUnique({
      where: { id: masterUserId },
      select: { mfaEnabled: true },
    });
    return { mfaEnabled: user?.mfaEnabled ?? false };
  }

  async updateLoginOtp(masterUserId: string, data: {
    loginEmailOtpHash: string; loginEmailOtpExpiresAt: Date; loginEmailOtpAttempts: number; loginEmailOtpSentAt: Date;
  }): Promise<void> {
    await this.prisma.masterUser.update({
      where: { id: masterUserId },
      data: {
        loginEmailOtpHash: data.loginEmailOtpHash,
        loginEmailOtpExpiresAt: data.loginEmailOtpExpiresAt,
        loginEmailOtpAttempts: data.loginEmailOtpAttempts,
        loginEmailOtpSentAt: data.loginEmailOtpSentAt,
      },
    });
  }

  async incrementLoginOtpAttempts(masterUserId: string): Promise<void> {
    await this.prisma.masterUser.update({
      where: { id: masterUserId },
      data: { loginEmailOtpAttempts: { increment: 1 } },
    });
  }

  async clearLoginOtp(masterUserId: string): Promise<void> {
    await this.prisma.masterUser.update({
      where: { id: masterUserId },
      data: {
        loginEmailOtpHash: null,
        loginEmailOtpExpiresAt: null,
        loginEmailOtpAttempts: 0,
        loginEmailOtpSentAt: null,
      },
    });
  }

  async updatePasswordChangeOtp(masterUserId: string, data: {
    passwordChangeEmailOtpHash: string; passwordChangeEmailOtpExpiresAt: Date; passwordChangeEmailOtpAttempts: number; passwordChangeEmailOtpSentAt: Date;
  }): Promise<void> {
    await this.prisma.masterUser.update({
      where: { id: masterUserId },
      data: {
        passwordChangeEmailOtpHash: data.passwordChangeEmailOtpHash,
        passwordChangeEmailOtpExpiresAt: data.passwordChangeEmailOtpExpiresAt,
        passwordChangeEmailOtpAttempts: data.passwordChangeEmailOtpAttempts,
        passwordChangeEmailOtpSentAt: data.passwordChangeEmailOtpSentAt,
      },
    });
  }

  async incrementPasswordChangeOtpAttempts(masterUserId: string): Promise<void> {
    await this.prisma.masterUser.update({
      where: { id: masterUserId },
      data: { passwordChangeEmailOtpAttempts: { increment: 1 } },
    });
  }

  async applyPasswordChange(masterUserId: string, passwordHash: string): Promise<void> {
    await this.prisma.masterUser.update({
      where: { id: masterUserId },
      data: {
        passwordHash,
        passwordChangeEmailOtpHash: null,
        passwordChangeEmailOtpExpiresAt: null,
        passwordChangeEmailOtpAttempts: 0,
        passwordChangeEmailOtpSentAt: null,
      },
    });
  }

  async updateMfaRecoveryCodes(masterUserId: string, hashes: string[]): Promise<void> {
    await this.prisma.masterUser.update({
      where: { id: masterUserId },
      data: { mfaRecoveryCodeHashes: hashes },
    });
  }

  async setMfaTempSecret(masterUserId: string, secret: string): Promise<void> {
    await this.prisma.masterUser.update({
      where: { id: masterUserId },
      data: { mfaTempSecret: secret },
    });
  }

  async activateMfa(masterUserId: string, data: { mfaSecret: string; recoveryCodeHashes: string[] }): Promise<void> {
    await this.prisma.masterUser.update({
      where: { id: masterUserId },
      data: {
        mfaEnabled: true,
        mfaSecret: data.mfaSecret,
        mfaTempSecret: null,
        mfaRecoveryCodeHashes: data.recoveryCodeHashes,
        mfaRecoveryCodeGeneratedAt: new Date(),
      },
    });
  }

  async deactivateMfa(masterUserId: string): Promise<void> {
    await this.prisma.masterUser.update({
      where: { id: masterUserId },
      data: { mfaEnabled: false, mfaSecret: null, mfaTempSecret: null, mfaRecoveryCodeHashes: [] },
    });
  }
}
