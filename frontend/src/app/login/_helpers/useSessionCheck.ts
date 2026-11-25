'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { ROLE_CONFIG, type InactiveUserInfo } from './loginConfig'

export function useSessionCheck(onResetToCredentials: () => void) {
  const t = useT('common')
  const router = useRouter()

  const [checkingSession, setCheckingSession] = useState(true)
  const [modeTestBandeau, setModeTestBandeau] = useState<string | null>(null)

  const [inactiveUser, setInactiveUser] = useState<InactiveUserInfo | null>(null)
  const [unlockPassword, setUnlockPassword] = useState('')
  const [unlockLoading, setUnlockLoading] = useState(false)
  const [unlockAlert, setUnlockAlert] = useState<string | null>(null)
  const [showUnlockPwd, setShowUnlockPwd] = useState(false)

  // Vérification de session active préalable (reprise d'application PWA, raccourci, onglet fermé/rouvert)
  useEffect(() => {
    let isMounted = true

    const verifyActiveSession = async () => {
      try {
        const raw = localStorage.getItem('zekoulabia_user')
        if (!raw) {
          if (isMounted) setCheckingSession(false)
          return
        }

        const parsed = JSON.parse(raw)
        const role = parsed?.role
        const dest = role ? ROLE_CONFIG[role]?.dest : null

        if (!dest) {
          if (isMounted) setCheckingSession(false)
          return
        }

        // Si inactif depuis plus de 7 jours consécutifs, proposer la re-validation rapide par mot de passe
        const INACTIVITY_MS = 7 * 24 * 60 * 60 * 1000
        const lastActiveAt = parsed?.lastActiveAt
        const isInactive = Boolean(lastActiveAt && Date.now() - Number(lastActiveAt) > INACTIVITY_MS)

        if (isInactive) {
          setInactiveUser({
            userId: parsed.userId,
            nomComplet: parsed.nomComplet || parsed.firstName || 'Utilisateur',
            role,
            dest,
          })
          if (isMounted) setCheckingSession(false)
          return
        }

        // Si l'appareil est hors-ligne, basculer directement sur le tableau de bord avec les données locales Dexie
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          router.replace(dest)
          return
        }

        try {
          const res = await fetchApi('/api/v2/users/me')
          if (res.ok) {
            router.replace(dest)
            return
          }

          if (res.status === 401 || res.status === 403) {
            try {
              localStorage.removeItem('zekoulabia_user')
            } catch {
              /* ignore */
            }
          }
        } catch {
          // Si une session locale existe sur la machine, basculer immédiatement sur le tableau de bord hors-ligne !
          router.replace(dest)
          return
        }
      } catch {
        // En cas d'erreur de parsing ou autre, afficher le formulaire normalement
      } finally {
        if (isMounted) setCheckingSession(false)
      }
    }

    verifyActiveSession()

    return () => {
      isMounted = false
    }
  }, [router])

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/v2/platform-settings/public')
        const data = await res.json()
        if (!res.ok) return
        if (!cancelled) setModeTestBandeau(data.outboundMessagingEnabled ? null : t('login.mode_test_bandeau_msg'))
      } catch {
        // erreur reseau : pas de bandeau
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [t])

  const handleUnlockSession = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!unlockPassword) {
      setUnlockAlert(t('fields.password'))
      return
    }
    setUnlockLoading(true)
    setUnlockAlert(null)
    try {
      const res = await fetchApi('/api/v2/users/auth/unlock-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: unlockPassword }),
      })
      const data = await res.json()
      if (data.success && inactiveUser) {
        const raw = localStorage.getItem('zekoulabia_user')
        if (raw) {
          const parsed = JSON.parse(raw)
          localStorage.setItem(
            'zekoulabia_user',
            JSON.stringify({
              ...parsed,
              lastActiveAt: Date.now(),
            })
          )
        }
        router.replace(inactiveUser.dest)
        return
      }
      setUnlockAlert(data.message || t('login.inactive_wrong_password'))
    } catch {
      setUnlockAlert(t('messages.networkError'))
    } finally {
      setUnlockLoading(false)
    }
  }

  const cancelUnlockSession = () => {
    try {
      localStorage.removeItem('zekoulabia_user')
    } catch {
      /* ignore */
    }
    setInactiveUser(null)
    setUnlockPassword('')
    setUnlockAlert(null)
    onResetToCredentials()
  }

  return {
    checkingSession,
    modeTestBandeau,
    inactiveUser,
    unlockPassword,
    setUnlockPassword,
    unlockLoading,
    unlockAlert,
    setUnlockAlert,
    showUnlockPwd,
    setShowUnlockPwd,
    handleUnlockSession,
    cancelUnlockSession,
  }
}
