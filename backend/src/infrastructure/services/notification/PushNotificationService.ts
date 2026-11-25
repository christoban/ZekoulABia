/**
 * PushNotificationService — miroir de SmsNotificationService.ts (mêmes conventions) :
 *   - Simulation mode (log console) quand les clés VAPID sont absentes
 *   - Respecte NotificationPreference.push par utilisateur (défaut : activé)
 *   - Nettoie automatiquement les souscriptions expirées (410/404 côté navigateur)
 *   - Ne throw jamais — toutes les fonctions publiques sont fire-and-forget safe
 *
 * `notifierUtilisateurPush` est le primitif générique bas niveau (équivalent de
 * `dispatchSms` dans SmsNotificationService.ts). La migration Phase B (voir
 * PLAN_NOTIFICATIONS_PUSH.md) ajoutera, événement par événement, des fonctions
 * `notifyXxxPush` bilingues qui l'enveloppent — comme `notifyAbsenceSms` enveloppe
 * `dispatchSms` aujourd'hui. Aucune n'est ajoutée ici tant qu'aucun appelant réel
 * n'existe (voir AGENTS.md §2 — ne pas construire par anticipation).
 */
import { prisma } from '@infrastructure/persistence/prisma/prisma.client'
import { sendPush, isPushConfigured } from './WebPushClient.ts'

export interface NotifierUtilisateurPushOptions {
  userId: string
  title: string
  body: string
  data?: Record<string, unknown>
}

async function isPushEnabledForUser(userId: string): Promise<boolean> {
  try {
    const pref = await prisma.notificationPreference.findUnique({ where: { userId } })
    // Pas encore de préférence enregistrée → défaut du schéma (activé)
    return pref ? pref.push : true
  } catch {
    return true
  }
}

export interface NotifierUtilisateurPushResultat {
  /** true si au moins un appareil a effectivement reçu la notification. */
  delivered: boolean
}

/**
 * Cœur partagé de l'envoi push — tente tous les appareils actifs d'un utilisateur (façon
 * WhatsApp : web + desktop + mobile reçoivent tous, si abonnés), supprime automatiquement
 * les souscriptions détectées expirées, et rapporte si au moins un envoi a réussi. Ne
 * throw jamais : toute erreur devient `{ delivered: false }`.
 */
async function envoyerEtRapporter(opts: NotifierUtilisateurPushOptions): Promise<NotifierUtilisateurPushResultat> {
  try {
    if (!(await isPushEnabledForUser(opts.userId))) return { delivered: false }

    if (!isPushConfigured()) {
      console.info(`[PUSH-SIMULATION] À: ${opts.userId} | ${opts.title} — ${opts.body}`)
      return { delivered: false }
    }

    const subscriptions = await prisma.pushSubscription.findMany({ where: { userId: opts.userId } })
    if (subscriptions.length === 0) return { delivered: false }

    const results = await Promise.all(
      subscriptions.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        const result = await sendPush({
          subscription: { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          title: opts.title,
          body: opts.body,
          data: opts.data,
        })

        if (result.status === 'expired') {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {
            // Déjà supprimée entre-temps (double envoi concurrent) — sans conséquence.
          })
          return false
        }

        if (result.status === 'sent') {
          await prisma.pushSubscription
            .update({ where: { id: sub.id }, data: { lastSeenAt: new Date() } })
            .catch(() => {})
          return true
        }

        console.warn(`[Push] Échec d'envoi à ${opts.userId} (${sub.id}) : ${result.error}`)
        return false
      }),
    )

    return { delivered: results.some(Boolean) }
  } catch (err) {
    console.error('[Push] Erreur inattendue:', err)
    return { delivered: false }
  }
}

/**
 * Envoie une notification push, fire-and-forget (ignore le résultat) — usage historique,
 * ex. via le port `NotificationService` (canal PUSH).
 */
export async function notifierUtilisateurPush(opts: NotifierUtilisateurPushOptions): Promise<void> {
  await envoyerEtRapporter(opts)
}

/**
 * Variante qui rapporte si l'envoi a effectivement atteint au moins un appareil — utilisée
 * par `sendTransactionalEmail` (voir emailService.ts) pour décider s'il faut basculer sur
 * l'email en repli (Phase B, voir PLAN_NOTIFICATIONS_PUSH.md §13).
 */
export async function notifierUtilisateurPushAvecResultat(
  opts: NotifierUtilisateurPushOptions,
): Promise<NotifierUtilisateurPushResultat> {
  return envoyerEtRapporter(opts)
}
