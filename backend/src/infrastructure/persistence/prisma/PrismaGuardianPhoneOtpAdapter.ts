import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { GuardianPhoneOtpPort } from '@domain/ports/services/GuardianPhoneOtpPort';
import { sendSms } from '@infrastructure/services/sms/SmsService';

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

function hashOtp(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function otpCorrespont(attendu: string, fourni: string): boolean {
  const gauche = Buffer.from(attendu, 'hex');
  const droite = Buffer.from(fourni, 'hex');
  return gauche.length === droite.length && timingSafeEqual(gauche, droite);
}

export class PrismaGuardianPhoneOtpAdapter implements GuardianPhoneOtpPort {
  constructor(private readonly prisma: PrismaClient) {}

  async envoyerOtpTelephone(command: {
    studentProfileId: string;
    schoolId: string;
    now?: Date;
  }): Promise<{ expiresAt: Date }> {
    const now = command.now ?? new Date();
    const link = await this.prisma.parentStudent.findFirst({
      where: {
        studentProfileId: command.studentProfileId,
        studentProfile: { schoolId: command.schoolId },
        contactPrincipal: true,
      },
      include: { parentProfile: { include: { user: { select: { phone: true } } } } },
    });
    const phone = link?.parentProfile.user.phone;
    if (!link || !phone) throw new Error('Le tuteur principal de cet élève n’a pas de téléphone.');

    const otp = String(randomInt(100000, 1000000));
    const expiresAt = new Date(now.getTime() + TTL_MINUTES * 60 * 1000);
    await this.prisma.parentStudent.update({
      where: {
        parentProfileId_studentProfileId: {
          parentProfileId: link.parentProfileId,
          studentProfileId: command.studentProfileId,
        },
      },
      data: { phoneOtpHash: hashOtp(otp), phoneOtpExpiresAt: expiresAt, phoneOtpAttempts: 0 },
    });

    const result = await sendSms({
      to: phone,
      message: `ZekoulABia : code de vérification du téléphone du tuteur : ${otp}. Valable ${TTL_MINUTES} minutes.`,
    });
    if (result.status !== 'sent') throw new Error(result.error ?? 'Échec d’envoi du SMS de vérification.');
    return { expiresAt };
  }

  async verifierOtpTelephone(command: {
    studentProfileId: string;
    schoolId: string;
    otp: string;
    now?: Date;
  }): Promise<void> {
    const now = command.now ?? new Date();
    const link = await this.prisma.parentStudent.findFirst({
      where: {
        studentProfileId: command.studentProfileId,
        studentProfile: { schoolId: command.schoolId },
        contactPrincipal: true,
      },
      select: {
        parentProfileId: true,
        studentProfileId: true,
        phoneOtpHash: true,
        phoneOtpExpiresAt: true,
        phoneOtpAttempts: true,
      },
    });
    if (!link?.phoneOtpHash) throw new Error('Aucun code de vérification en cours.');
    if (link.phoneOtpAttempts >= MAX_ATTEMPTS) throw new Error('Nombre maximal de tentatives atteint.');
    if (!link.phoneOtpExpiresAt || link.phoneOtpExpiresAt <= now) {
      throw new Error('Le code de vérification a expiré.');
    }

    const cle = { parentProfileId: link.parentProfileId, studentProfileId: link.studentProfileId };
    const valide = otpCorrespont(link.phoneOtpHash, hashOtp(command.otp));
    if (!valide) {
      await this.prisma.parentStudent.updateMany({
        where: { ...cle, phoneOtpAttempts: { lt: MAX_ATTEMPTS } },
        data: { phoneOtpAttempts: { increment: 1 } },
      });
      throw new Error('Code de vérification invalide.');
    }

    await this.prisma.parentStudent.updateMany({
      where: { ...cle, phoneVerified: false },
      data: {
        phoneVerified: true,
        phoneVerifiedAt: now,
        phoneOtpHash: null,
        phoneOtpExpiresAt: null,
        phoneOtpAttempts: 0,
      },
    });
  }
}
