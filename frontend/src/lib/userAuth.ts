import { db } from '@/lib/offline/db'
import { purgerCle } from '@/lib/offline/crypto'

/**
 * Déconnecte l'utilisateur : appelle POST /api/v2/users/auth/logout (efface les cookies
 * httpOnly côté serveur), purge le stockage local complet, puis redirige vers /login.
 * Avertit si des actions non synchronisées ou messages non envoyés existent (perte de
 * données si confirmée).
 */
export async function logoutUser(): Promise<void> {
  // Avertir si des actions ne sont pas encore synchronisées — les perdre silencieusement sur
  // une déconnexion explicite serait une vraie perte de données (note/absence saisie hors ligne,
  // jamais envoyée au serveur). Recommandé fortement, pas dans le plan d'origine mot pour mot,
  // mais découle directement de son esprit ("ne jamais perdre de données").
  const pendingCount = await db.pendingActions.where('status').anyOf(['PENDING', 'FAILED', 'CONFLICT']).count()
  if (pendingCount > 0) {
    const confirme = window.confirm(
      `${pendingCount} action(s) non synchronisée(s) seront perdues si vous vous déconnectez maintenant. Continuer quand même ?`
    )
    if (!confirme) return
  }

  // Vérifier les messages non envoyés (status PENDING) avant de purger db.messages.
  // Un message PENDING = message créé en offline mais jamais envoyé au serveur.
  // Le supprimer silencieusement = perte de données pour l'utilisateur.
  const unsentMessages = await db.messages.where('status').equals('PENDING').count()
  if (unsentMessages > 0) {
    const confirme = window.confirm(
      `${unsentMessages} message(s) non envoyé(s) seront perdus si vous vous déconnectez. Continuer quand même ?`
    )
    if (!confirme) return
  }

  try {
    await fetch('/api/v2/users/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
  } catch {
    // Même si le serveur est inaccessible, on purge et redirige quand même
  }

  // Purge immédiate et complète du cache local — cas de sécurité réel (appareil partagé),
  // aucun délai de grâce (Plan offline-first V1 §3).
  await db.cachedData.clear()
  await db.pendingActions.clear()
  await db.messages.clear()
  localStorage.removeItem('zekoulabia_user')
  purgerCle() // clé de chiffrement — voir tâche 4
  try {
    const { resetNotificationSocket } = await import('@/lib/notificationSocket')
    resetNotificationSocket()
  } catch { /* ignore */ }

  window.location.href = '/login'
}