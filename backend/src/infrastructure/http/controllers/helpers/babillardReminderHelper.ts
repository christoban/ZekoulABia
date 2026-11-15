import type { NotificationService } from '@domain/ports/services/NotificationService';
import type { SmsNotificationPort } from '@domain/ports/services/SmsNotificationPort';
import type { Publication } from '@domain/entities/Publication';
import type { DestinataireLectureItem } from '@domain/ports/repositories/PublicationRepository';

/** Envoie rappels Push/In-App + SMS secours aux destinataires n'ayant pas encore lu une annonce. */
export async function dispatchBabillardReminders(params: {
  schoolId: string;
  pub: Publication;
  targets: DestinataireLectureItem[];
  notificationService?: NotificationService;
  smsNotification?: SmsNotificationPort;
}): Promise<{ notifiedCount: number; smsCount: number }> {
  const { schoolId, pub, targets, notificationService, smsNotification } = params;
  if (notificationService && targets.length > 0) {
    await Promise.allSettled(
      targets
        .filter((d) => d.accessMode !== 'NO_LOGIN')
        .map((d) =>
          notificationService.envoyer({
            schoolId,
            userId: d.userId,
            type: 'COMMUNICATION',
            titre: `Rappel : ${pub.titre}`,
            corps: 'Merci de consulter cette publication sur le babillard officiel.',
            urgency: 'HIGH',
            metadata: { publicationId: pub.id, reminder: true },
          }),
        ),
    );
  }

  const phones = Array.from(
    new Set(
      targets
        .map((d) => d.phone)
        .filter((p): p is string => Boolean(p && p.trim().length > 0)),
    ),
  );
  if (phones.length > 0 && smsNotification?.notifyGenericAlertSms) {
    await smsNotification.notifyGenericAlertSms({
      schoolId,
      phones,
      message: `[Rappel Babillard] ${pub.titre} — Merci d'en prendre connaissance.`,
    });
  }

  return { notifiedCount: targets.length, smsCount: phones.length };
}

