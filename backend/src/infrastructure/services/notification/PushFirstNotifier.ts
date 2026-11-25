/**
 * Orchestrateur "push d'abord" pour les alertes destinées aux parents — factorise le pattern
 * construit pour la bibliothèque (Juillet 2026) : cloche systématique + push tenté en premier,
 * SMS uniquement pour les parents dont le push n'atteint aucun appareil. Jamais les deux à la
 * fois pour un même parent — même principe de repli déjà en place pour l'email (Phase B,
 * sendTransactionalEmail), appliqué ici au SMS. Réutilisé par les alertes absence, retard de
 * paiement, sanction disciplinaire et retard de bibliothèque.
 */
import type { NotificationType } from '@domain/types/enums';
import { SocketNotificationService } from './SocketNotificationService.ts';
import { notifierUtilisateurPushAvecResultat } from './PushNotificationService.ts';
import { getParentContacts } from '../sms/SmsNotificationService.ts';

const notificationService = new SocketNotificationService();

export async function notifierParentsPushDabord(opts: {
  schoolId: string;
  studentId: string;
  type: NotificationType;
  titre: string;
  corps: string;
}): Promise<{ phonesSansPush: string[] }> {
  const parents = await getParentContacts(opts.studentId);
  const phonesSansPush: string[] = [];

  for (const parent of parents) {
    await notificationService
      .envoyer({ schoolId: opts.schoolId, userId: parent.userId, type: opts.type, titre: opts.titre, corps: opts.corps, urgency: 'HIGH' })
      .catch((err) => console.error('[PushFirstNotifier] IN_APP parent:', err?.message));

    const result = await notifierUtilisateurPushAvecResultat({ userId: parent.userId, title: opts.titre, body: opts.corps })
      .catch(() => ({ delivered: false }));

    if (!result.delivered && parent.phone) phonesSansPush.push(parent.phone);
  }

  return { phonesSansPush };
}
