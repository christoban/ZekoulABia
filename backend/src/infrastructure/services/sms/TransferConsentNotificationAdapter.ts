import type { PrismaClient } from '@prisma/client';
import type { TransferConsentNotificationPort } from '@domain/ports/services/TransferConsentNotificationPort';
import { sendSms } from './SmsService';

export class TransferConsentNotificationAdapter implements TransferConsentNotificationPort {
  constructor(private readonly prisma: PrismaClient) {}

  async sendChallenge(input: {
    phone: string;
    rawToken: string;
    otp: string;
    requestId: string;
    expiresAt: Date;
    notificationKey: string;
    force?: boolean;
  }): Promise<{ providerMessageId?: string }> {
    const existing = await this.prisma.transferConsent.findUnique({
      where: { notificationKey: input.notificationKey },
      select: { smsSentAt: true, smsProviderMessageId: true },
    });
    if (existing?.smsSentAt && !input.force) return { providerMessageId: existing.smsProviderMessageId ?? undefined };

    const baseUrl = process.env.TRANSFER_CONSENT_BASE_URL;
    if (!baseUrl) throw new Error('TRANSFER_CONSENT_BASE_URL non configurée.');
    const link = `${baseUrl.replace(/\/$/, '')}/student-transfers/consent/${encodeURIComponent(input.requestId)}?token=${encodeURIComponent(input.rawToken)}`;
    const result = await sendSms({
      to: input.phone,
      message: `ZekoulABia : confirmez le transfert de l'élève via ${link}. Code OTP : ${input.otp}. Lien valable jusqu'au ${input.expiresAt.toLocaleString('fr-FR')}.`,
    });
    if (result.status !== 'sent') throw new Error(result.error ?? 'Échec d’envoi du SMS de consentement.');

    await this.prisma.transferConsent.updateMany({
      where: { notificationKey: input.notificationKey },
      data: { smsSentAt: new Date(), smsProviderMessageId: result.providerMessageId },
    });
    return { providerMessageId: result.providerMessageId };
  }
}
