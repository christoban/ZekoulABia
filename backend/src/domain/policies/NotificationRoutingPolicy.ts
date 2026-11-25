import type { NotificationChannel, NotificationUrgency } from '@domain/types/enums';

export interface PrefsCanal {
  push: boolean;
  sms: boolean;
  /** email réservé ; non utilisé par la matrice synchrone actuelle */
  email?: boolean;
}

/**
 * Matrice urgence → canaux.
 *
 * - LOW / NORMAL / HIGH : respectent les préférences utilisateur.
 * - URGENT : IGNORE les préférences push/sms (force la matrice) — alerte critique métier.
 *
 * hasActivePushToken : au moins une PushSubscription active côté infra.
 * prefs : null = tout activé (défaut schéma).
 */
export function resoudreCanal(
  urgency: NotificationUrgency,
  hasActivePushToken: boolean,
  prefs: PrefsCanal | null = null,
): NotificationChannel[] {
  const pushOk = prefs?.push !== false;
  const smsOk = prefs?.sms !== false;
  const force = urgency === 'URGENT';

  const wantPush = force || pushOk;
  const wantSms = force || smsOk;

  switch (urgency) {
    case 'LOW':
      return ['IN_APP'];

    case 'NORMAL':
    case 'HIGH': {
      if (hasActivePushToken && wantPush) return ['PUSH', 'IN_APP'];
      return ['IN_APP'];
    }

    case 'URGENT': {
      if (hasActivePushToken && wantPush) return ['PUSH', 'IN_APP'];
      return wantSms ? ['SMS', 'IN_APP'] : ['IN_APP'];
    }
  }
}
