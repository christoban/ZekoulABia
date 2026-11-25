'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'

/**
 * Événement personnalisé émis par BabillardBoard (marquage lu, suppression, publication)
 * pour synchroniser en temps réel le badge des sidebars et bottom navs sans contexte React partagé.
 */
export const EVENEMENT_BABILLARD_NON_LUS_CHANGE = 'babillard:unread-changed'

export function useUnreadBabillardCount(): number {
  const [count, setCount] = useState(0)

  const rafraichir = useCallback(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) return
    try {
      const res = await fetchApi('/api/v2/babillard/non-lus/compteur', { cache: 'no-store' })
      if (!res.ok) return
      const body = (await res.json()) as { success?: boolean; data?: { count?: number } }
      if (body?.success) {
        setCount(Number(body.data?.count ?? 0))
      }
    } catch {
      /* silencieux — conserve la dernière valeur connue */
    }
  }, [])

  useEffect(() => {
    void rafraichir()

    const onChange = () => void rafraichir()
    window.addEventListener(EVENEMENT_BABILLARD_NON_LUS_CHANGE, onChange)
    window.addEventListener('zekoulabia:data-changed', onChange)

    return () => {
      window.removeEventListener(EVENEMENT_BABILLARD_NON_LUS_CHANGE, onChange)
      window.removeEventListener('zekoulabia:data-changed', onChange)
    }
  }, [rafraichir])

  return count
}

