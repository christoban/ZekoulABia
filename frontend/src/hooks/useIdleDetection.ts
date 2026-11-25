'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Détecte l'inactivité utilisateur (souris, clavier, clic, scroll) et retourne `true`
 * après `thresholdMs` sans aucune de ces interactions. `enabled=false` désactive le
 * détecteur et force `isIdle` à `false` (ex. quand l'écran n'est pas prioritaire, ou
 * qu'une autre UI est déjà ouverte).
 */
export function useIdleDetection(thresholdMs: number, enabled: boolean = true): boolean {
  const [isIdle, setIsIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!enabled) {
      setIsIdle(false)
      return
    }

    const reset = () => {
      setIsIdle(false)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setIsIdle(true), thresholdMs)
    }

    const events = ['mousemove', 'keydown', 'click', 'scroll'] as const
    events.forEach(ev => window.addEventListener(ev, reset, { passive: true }))
    reset()

    return () => {
      events.forEach(ev => window.removeEventListener(ev, reset))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [thresholdMs, enabled])

  return isIdle
}
