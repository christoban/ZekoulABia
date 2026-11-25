'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fetchApi } from '@/lib/fetchApi'
import { getUserSession, putUserSession } from '@/lib/offline/db'
import { getSectionsFromPermissions, type StaffSection, type SessionUser, type Toast } from '../_types'
import { preloadStaffData } from './staffPreload'

const DEFAULT_ALLOWED_SECTIONS: StaffSection[] = [
  'dashboard',
  'mon-profil-rh',
  'notifications',
  'babillard',
  'carnet-liaison',
  'messagerie',
  'moderation-messagerie',
  'sync-offline',
  'configuration',
]

let toastId = 0

export function useStaffDashboardShell() {
  const router = useRouter()
  const [section, setSection] = useState<StaffSection>('dashboard')
  const [visitedSections, setVisitedSections] = useState<Set<StaffSection>>(() => new Set(['dashboard']))

  useEffect(() => {
    setVisitedSections(prev => {
      if (prev.has(section)) return prev
      const next = new Set(prev)
      next.add(section)
      return next
    })
  }, [section])

  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [allowedSections, setAllowedSections] = useState<Set<StaffSection>>(() => new Set(DEFAULT_ALLOWED_SECTIONS))
  const [schoolName, setSchoolName] = useState<string | undefined>(undefined)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [changePwdOpen, setChangePwdOpen] = useState(false)
  const [hasActiveEntranceExam, setHasActiveEntranceExam] = useState(false)

  // Vérification de la présence d'un concours d'entrée actif (événement ou session)
  const checkActiveConcours = useCallback(() => {
    fetchApi('/api/v2/academic-events/active', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success && Array.isArray(d.data)) {
          const hasEvent = d.data.some((e: { type: string; status?: string }) => e.type === 'CONCOURS_ENTREE')
          if (hasEvent) {
            setHasActiveEntranceExam(true)
            return
          }
        }
        return fetchApi('/api/v2/entrance-exams', { credentials: 'include' })
          .then(r2 => r2.json())
          .then(d2 => {
            if (d2.success && Array.isArray(d2.data)) {
              setHasActiveEntranceExam(d2.data.some((s: { status: string }) => s.status !== 'CLOSED'))
            }
          })
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    checkActiveConcours()
  }, [checkActiveConcours])

  useEffect(() => {
    const handleNotification = () => {
      checkActiveConcours()
    }
    window.addEventListener('zekoulabia:notification', handleNotification)
    return () => window.removeEventListener('zekoulabia:notification', handleNotification)
  }, [checkActiveConcours])

  // Lecture session depuis localStorage (stockée au login) + restauration Dexie offline
  useEffect(() => {
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      if (raw) {
        const user = JSON.parse(raw) as SessionUser
        setSessionUser(user)
        const allowed = getSectionsFromPermissions(user.permissions ?? [])
        setAllowedSections(allowed)

        getUserSession(user.userId).then(saved => {
          if (saved?.schoolInfo) {
            setSchoolName(saved.schoolInfo.name)
            setLogoUrl(saved.schoolInfo.logoUrl ?? null)
          }
        }).catch(() => {})

        const params = new URLSearchParams(window.location.search)
        const convId = params.get('conversationId')
        const targetSection = params.get('section')
        if (convId) {
          setSection('messagerie')
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('zekoulabia:open-conversation', { detail: { conversationId: convId } }))
          }, 150)
        } else if (targetSection && allowed.has(targetSection as StaffSection)) {
          setSection(targetSection as StaffSection)
        }
      }
    } catch { /* silencieux — données absentes ou corrompues */ }
  }, [])

  // Infos école depuis l'API
  useEffect(() => {
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) {
          try { localStorage.removeItem('zekoulabia_user') } catch { /* ignore */ }
          router.replace('/login')
          return Promise.reject('auth')
        }
        return r.json()
      })
      .then(d => {
        if (d.success) {
          setSchoolName(d.data.name)
          setLogoUrl(d.data.logoUrl ?? null)
          try {
            const raw = localStorage.getItem('zekoulabia_user')
            if (raw) {
              const u = JSON.parse(raw)
              putUserSession({ userId: u.userId, role: u.role, schoolInfo: d.data }).catch(() => {})
            }
          } catch { /* ignore */ }
        }
      })
      .catch(err => { if (err !== 'auth') console.warn('[staff-dashboard] Erreur réseau:', err) })
  }, [router])

  // Préchargement offline-first silencieux en tâche de fond pour l'ensemble des modules Staff
  useEffect(() => {
    if (!sessionUser || typeof navigator === 'undefined' || !navigator.onLine) return
    let cancelled = false
    preloadStaffData(sessionUser.userId, () => cancelled)
    return () => {
      cancelled = true
    }
  }, [sessionUser])

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const navTo = useCallback((s: StaffSection) => {
    if (allowedSections.has(s)) setSection(s)
  }, [allowedSections])

  const can = (s: StaffSection) => allowedSections.has(s)

  // Navigation temps réel déclenchée par l'assistant IA (copilot) : quand il exécute
  // une action, on bascule vers l'écran concerné pour que le changement soit visible.
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const navSection = (e as CustomEvent<{ section?: string }>).detail?.section
      if (navSection) navTo(navSection as StaffSection)
    }
    window.addEventListener('zekoulabia:navigate', onNavigate)
    return () => window.removeEventListener('zekoulabia:navigate', onNavigate)
  }, [navTo])

  return {
    section,
    setSection,
    visitedSections,
    mobileNavOpen,
    setMobileNavOpen,
    toasts,
    showToast,
    removeToast,
    sessionUser,
    allowedSections,
    schoolName,
    logoUrl,
    changePwdOpen,
    setChangePwdOpen,
    hasActiveEntranceExam,
    navTo,
    can,
  }
}
