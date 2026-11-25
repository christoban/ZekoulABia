import type { PrismaClient } from '@prisma/client';
import type {
  SchoolGroupOwnerAuthRepository,
  GroupOwnerAuthData,
} from '@domain/ports/repositories/SchoolGroupOwnerAuthRepository';

export class PrismaSchoolGroupOwnerAuthRepository implements SchoolGroupOwnerAuthRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<GroupOwnerAuthData | null> {
    return this.prisma.schoolGroupOwner.findUnique({ where: { email } }) as Promise<GroupOwnerAuthData | null>;
  }

  async findById(ownerId: string): Promise<GroupOwnerAuthData | null> {
    return this.prisma.schoolGroupOwner.findUnique({ where: { id: ownerId } }) as Promise<GroupOwnerAuthData | null>;
  }

  async getMfaStatus(ownerId: string): Promise<{ mfaEnabled: boolean }> {
    const owner = await this.prisma.schoolGroupOwner.findUnique({
      where: { id: ownerId },
      select: { mfaEnabled: true },
    });
    return { mfaEnabled: owner?.mfaEnabled ?? false };
  }

  async updateLoginOtp(ownerId: string, data: { loginEmailOtpHash: string; loginEmailOtpExpiresAt: Date; loginEmailOtpAttempts: number; loginEmailOtpSentAt: Date }): Promise<void> {
    await this.prisma.schoolGroupOwner.update({
      where: { id: ownerId },
      data: {
        loginEmailOtpHash: data.loginEmailOtpHash,
        loginEmailOtpExpiresAt: data.loginEmailOtpExpiresAt,
        loginEmailOtpAttempts: data.loginEmailOtpAttempts,
        loginEmailOtpSentAt: data.loginEmailOtpSentAt,
      },
    });
  }

  async incrementLoginOtpAttempts(ownerId: string): Promise<void> {
    await this.prisma.schoolGroupOwner.update({
      where: { id: ownerId },
      data: { loginEmailOtpAttempts: { increment: 1 } },
    });
  }

  async clearLoginOtp(ownerId: string): Promise<void> {
    await this.prisma.schoolGroupOwner.update({
      where: { id: ownerId },
      data: {
        loginEmailOtpHash: null,
        loginEmailOtpExpiresAt: null,
        loginEmailOtpAttempts: 0,
        loginEmailOtpSentAt: null,
      },
    });
  }

  async updateMfaRecoveryCodes(ownerId: string, hashes: string[]): Promise<void> {
    await this.prisma.schoolGroupOwner.update({
      where: { id: ownerId },
      data: { mfaRecoveryCodeHashes: hashes },
    });
  }

  async setMfaTempSecret(ownerId: string, secret: string): Promise<void> {
    await this.prisma.schoolGroupOwner.update({
      where: { id: ownerId },
      data: { mfaTempSecret: secret },
    });
  }

  async activateMfa(ownerId: string, data: { mfaSecret: string; recoveryCodeHashes: string[] }): Promise<void> {
    await this.prisma.schoolGroupOwner.update({
      where: { id: ownerId },
      data: {
        mfaEnabled: true,
        mfaSecret: data.mfaSecret,
        mfaTempSecret: null,
        mfaRecoveryCodeHashes: data.recoveryCodeHashes,
        mfaRecoveryCodeGeneratedAt: new Date(),
      },
    });
  }

  async deactivateMfa(ownerId: string): Promise<void> {
    await this.prisma.schoolGroupOwner.update({
      where: { id: ownerId },
      data: { mfaEnabled: false, mfaSecret: null, mfaTempSecret: null, mfaRecoveryCodeHashes: [] },
    });
  }
}