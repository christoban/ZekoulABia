'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { getNotificationSocket } from '@/lib/notificationSocket'

/**
 * Nom de l'événement window personnalisé émis par la messagerie (ouverture d'une conversation,
 * marquage "lu") pour que le badge de sidebar se resynchronise sans dépendre d'un contexte React
 * partagé — même esprit que le pattern NotificationContext, en plus léger puisque ce badge est
 * consommé par 5 sidebars indépendantes plutôt qu'une cloche unique.
 */
export const EVENEMENT_MESSAGERIE_NON_LUS_CHANGE = 'messagerie:unread-changed'

export function useUnreadMessagesCount(): number {
  const [count, setCount] = useState(0)

  const rafraichir = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/messagerie/non-lus')
      const body = await res.json()
      if (body?.success) setCount(body.data.count ?? 0)
    } catch { /* silencieux — le badge reste à sa dernière valeur connue */ }
  }, [])

  useEffect(() => {
    rafraichir()

    const socket = getNotificationSocket()
    socket.on('message:new', rafraichir)
    window.addEventListener(EVENEMENT_MESSAGERIE_NON_LUS_CHANGE, rafraichir)

    return () => {
      socket.off('message:new', rafraichir)
      window.removeEventListener(EVENEMENT_MESSAGERIE_NON_LUS_CHANGE, rafraichir)
    }
  }, [rafraichir])

  return count
}
