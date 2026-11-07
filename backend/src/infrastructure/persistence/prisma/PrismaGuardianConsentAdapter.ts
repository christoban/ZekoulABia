import { createHash, timingSafeEqual } from 'node:crypto';
import { Prisma, type PrismaClient, type TransferConsentDecision } from '@prisma/client';
import type {
  GuardianConsentPort,
  VerifiedTransferConsent,
} from '@domain/ports/services/GuardianConsentPort';

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function equalsHash(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer);
}

export class PrismaGuardianConsentAdapter implements GuardianConsentPort {
  constructor(private readonly prisma: PrismaClient) {}

  async verifyAndConsume(input: {
    token: string;
    otp: string;
    decision: 'ACCEPT' | 'REFUSE';
    channel: VerifiedTransferConsent['channel'];
  }): Promise<VerifiedTransferConsent> {
    const tokenHash = hash(input.token);
    const consent = await this.prisma.transferConsent.findUnique({
      where: { tokenHash },
      include: { transferRequest: true },
    });
    if (!consent) throw new Error('Lien de consentement invalide.');
    if (consent.consumedAt || consent.tokenExpiresAt <= new Date()) {
      throw new Error('Lien de consentement expiré ou déjà utilisé.');
    }
    if (consent.otpAttempts >= 5) throw new Error('Nombre maximal de tentatives OTP atteint.');

    const otpMatches = equalsHash(hash(input.otp), consent.otpHash);
    if (!otpMatches) {
      await this.prisma.transferConsent.updateMany({
        where: { id: consent.id, consumedAt: null, otpAttempts: { lt: 5 } },
        data: { otpAttempts: { increment: 1 } },
      });
      throw new Error('OTP invalide.');
    }

    const consumed = await this.prisma.transferConsent.updateMany({
      where: { id: consent.id, consumedAt: null, tokenExpiresAt: { gt: new Date() } },
      data: {
        consumedAt: new Date(),
        decidedAt: new Date(),
        decision: input.decision === 'REFUSE' ? 'REFUSED' : 'ACCEPTED',
        channel: input.channel,
      },
    });
    if (consumed.count !== 1) throw new Error('Consentement déjà consommé.');

    return {
      requestId: consent.transferRequestId,
      consenterType: consent.consenterType,
      consenterRef: consent.consenterRef,
      channel: consent.channel,
      consentTextVersion: consent.consentTextVersion,
      scopeAccepted: consent.scopeAccepted,
      ipAddress: consent.ipAddress,
    };
  }

  async revokeIfHolder(input: { token: string; requestId: string }): Promise<{
    consenterType: VerifiedTransferConsent['consenterType'];
    consenterRef: string;
  } | null> {
    const consent = await this.prisma.transferConsent.findUnique({
      where: { tokenHash: hash(input.token) },
    });
    if (!consent || consent.transferRequestId !== input.requestId) return null;
    if (consent.tokenExpiresAt <= new Date()) return null;

    await this.prisma.transferConsent.updateMany({
      where: { id: consent.id, decision: { in: ['PENDING', 'ACCEPTED'] as TransferConsentDecision[] } },
      data: { decision: 'REVOKED' },
    });

    return { consenterType: consent.consenterType, consenterRef: consent.consenterRef };
  }
}
