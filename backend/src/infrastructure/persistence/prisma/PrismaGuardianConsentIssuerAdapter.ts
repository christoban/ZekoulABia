import { createHash, randomBytes, randomInt } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { estEleveMajeur } from '@application/studentTransfer/guardianPolicy';
import { STUDENT_TRANSFER_CONFIG } from '@application/studentTransfer/config';
import type {
  GuardianConsentIssuerPort,
  TransferConsentChallenge,
} from '@domain/ports/services/GuardianConsentIssuerPort';

function hash(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

export class PrismaGuardianConsentIssuerAdapter implements GuardianConsentIssuerPort {
  constructor(private readonly prisma: PrismaClient) {}

  async issueChallenge(input: {
    requestId: string;
    consentTextVersion: string;
    scopeAccepted: boolean;
    forceResend?: boolean;
    now?: Date;
  }): Promise<TransferConsentChallenge> {
    const now = input.now ?? new Date();
    const request = await this.prisma.transferRequest.findUnique({
      where: { id: input.requestId },
      include: {
        sourceStudentProfile: {
          include: {
            user: { select: { id: true, phone: true } },
            parents: {
              where: { contactPrincipal: true, phoneVerified: true },
              include: { parentProfile: { include: { user: { select: { id: true, phone: true } } } } },
              take: 1,
            },
          },
        },
      },
    });
    if (!request) throw new Error('Demande de transfert introuvable.');
    if (request.status !== 'PENDING_GUARDIAN') throw new Error('La demande n’attend plus le consentement.');

    const adult = request.sourceStudentProfile.dateOfBirth
      ? estEleveMajeur(request.sourceStudentProfile.dateOfBirth, now)
      : false;
    const guardian = request.sourceStudentProfile.parents[0]?.parentProfile;
    const consenterType: 'ADULT_STUDENT' | 'GUARDIAN' = adult ? 'ADULT_STUDENT' : 'GUARDIAN';
    const consenterRef = adult ? request.sourceStudentProfile.user.id : guardian?.id;
    const phone = adult ? request.sourceStudentProfile.user.phone : guardian?.user.phone;
    if (!consenterRef || !phone) throw new Error('Aucun téléphone vérifié disponible pour le consentement.');

    const notificationKey = `student-transfer-consent:${request.id}`;
    const existing = await this.prisma.transferConsent.findUnique({ where: { notificationKey } });
    if (existing?.smsSentAt && !input.forceResend) {
      throw new Error('Le lien de consentement a déjà été envoyé.');
    }

    const rawToken = randomBytes(32).toString('hex');
    const otp = String(randomInt(100000, 1000000));
    const expiresAt = new Date(
      now.getTime() + STUDENT_TRANSFER_CONFIG.consentLinkTtlHours * 60 * 60 * 1000,
    );

    const data: Prisma.TransferConsentUncheckedCreateInput = {
      transferRequestId: request.id,
      consenterType,
      consenterRef,
      decision: 'PENDING' as const,
      channel: 'LINK_OTP' as const,
      consentTextVersion: input.consentTextVersion,
      scopeAccepted: input.scopeAccepted,
      tokenHash: hash(rawToken),
      tokenExpiresAt: expiresAt,
      otpHash: hash(otp),
      otpAttempts: 0,
      consumedAt: null,
      smsSentAt: null,
      notificationKey,
    };
    if (existing) {
      const updateData: Prisma.TransferConsentUncheckedUpdateInput = { ...data };
      delete updateData.transferRequestId;
      await this.prisma.transferConsent.update({ where: { id: existing.id }, data: updateData });
    } else {
      await this.prisma.transferConsent.create({ data });
    }

    return { requestId: request.id, consenterType, phone, rawToken, otp, expiresAt, notificationKey };
  }
}
