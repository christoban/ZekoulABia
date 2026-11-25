export type NavigableNotification = {
  id: string
  type: string
  isRead: boolean
  metadata?: Record<string, unknown> | null
}

/**
 * Gère le clic sur une notification (in-app ou out-app) :
 * 1. Marque la notification comme lue si nécessaire
 * 2. Ferme le popover/dropdown si fourni
 * 3. Navigue vers la bonne section ou ouvre la conversation correspondante
 */
export function handleNotificationClick(
  notification: NavigableNotification,
  options?: {
    markAsRead?: (id: string) => void
    onNav?: (section: string) => void
    onClose?: () => void
  }
): void {
  if (options?.markAsRead && !notification.isRead) {
    options.markAsRead(notification.id)
  }

  if (options?.onClose) {
    options.onClose()
  }

  const meta = (notification.metadata ?? {}) as Record<string, unknown>

  // 1. Action modale spécifique (ex : clôture d'année)
  if (meta.action === 'OPEN_CLOTURE_MODAL') {
    window.dispatchEvent(new CustomEvent('zekoulabia:open-cloture-modal', { detail: meta }))
    return
  }

  // 2. Notification d'un message / conversation de messagerie
  if (meta.conversationId && typeof meta.conversationId === 'string') {
    if (options?.onNav) options.onNav('messagerie')
    window.dispatchEvent(new CustomEvent('zekoulabia:navigate', { detail: { section: 'messagerie' } }))
    window.dispatchEvent(
      new CustomEvent('zekoulabia:open-conversation', {
        detail: { conversationId: meta.conversationId },
      })
    )
    return
  }

  // 3. Section explicite fournie dans metadata
  if (meta.section && typeof meta.section === 'string') {
    if (options?.onNav) options.onNav(meta.section)
    window.dispatchEvent(new CustomEvent('zekoulabia:navigate', { detail: { section: meta.section } }))
    return
  }

  // 4. Routage intelligent par type de notification
  let targetSection: string | null = null

  switch (notification.type) {
    case 'COMMUNICATION':
      if (meta.babillardId || meta.announcementId) {
        targetSection = 'babillard'
      } else {
        targetSection = 'messagerie'
      }
      break

    case 'ATTENDANCE':
      targetSection = 'attendance'
      break

    case 'ACADEMIC':
      targetSection = meta.bulletinId ? 'bulletins' : 'grades'
      break

    case 'FINANCIAL':
      try {
        const raw = localStorage.getItem('zekoulabia_user')
        const role = raw ? JSON.parse(raw)?.role : null
        targetSection = role === 'ADMIN' ? 'finance' : 'payments'
      } catch {
        targetSection = 'payments'
      }
      break

    default:
      break
  }

  if (targetSection) {
    if (options?.onNav) options.onNav(targetSection)
    window.dispatchEvent(new CustomEvent('zekoulabia:navigate', { detail: { section: targetSection } }))
  }
}
