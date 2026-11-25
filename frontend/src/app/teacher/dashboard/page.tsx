'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logoutUser } from '@/lib/userAuth'
import TeacherSidebar from './_components/TeacherSidebar'
import TeacherTopbar from './_components/TeacherTopbar'
import TeacherBottomNav from './_components/TeacherBottomNav'
import TeacherToast from './_components/TeacherToast'
import type { TeacherSection, Toast, UserInfo } from './_types'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { getUserSession, putUserSession } from '@/lib/offline/db'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import AssistantWidget from '../../admin/dashboard/_components/AssistantWidget'
import EventCenterWidget from '@/features/communication/EventCenterWidget'
import { useT } from '@/lib/i18n'
import ModeTestBanner from '@/components/ModeTestBanner'
import TeacherMainContent from './_pageParts/TeacherMainContent'
import { prefetchTeacherOfflineData } from './_pageParts/prefetchTeacherOfflineData'
import {
  getTeacherTitles,
  TEACHER_ASSISTANT_SUGGESTIONS,
  TEACHER_SECTIONS,
  type SessionUser,
} from './_pageParts/constants'

let toastId = 0

export default function TeacherDashboard() {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const router = useRouter()
  const TITLES = getTeacherTitles(tnav)

  const [section, setSection] = useState<TeacherSection>('dashboard')
  const [visitedSections, setVisitedSections] = useState<Set<TeacherSection>>(() => new Set(['dashboard']))

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
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logoUrl: string | null } | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [pendingGrades, setPendingGrades] = useState<number>(0)
  const [changePwdOpen, setChangePwdOpen] = useState(false)
  const [selectedPPClassId, setSelectedPPClassId] = useState<string>('')
  const [selectedAPDeptId, setSelectedAPDeptId] = useState<string>('')
  const { pendingCount } = useSyncQueue()

  useEffect(() => {
    if (user?.classesProfessorPrincipal?.length && (!selectedPPClassId || !user.classesProfessorPrincipal.some(c => c.id === selectedPPClassId))) {
      setSelectedPPClassId(user.classesProfessorPrincipal[0].id)
    }
    if (user?.headedDepartments?.length && (!selectedAPDeptId || !user.headedDepartments.some(d => d.id === selectedAPDeptId))) {
      setSelectedAPDeptId(user.headedDepartments[0].id)
    }
  }, [user, selectedPPClassId, selectedAPDeptId])

  // Lecture session depuis localStorage + restauration profil complet depuis Dexie userSession
  useEffect(() => {
    let currentUserId = ''
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      if (raw) {
        const sessionUser = JSON.parse(raw) as SessionUser
        currentUserId = sessionUser.userId
        setUser({ id: sessionUser.userId, firstName: sessionUser.firstName ?? '', lastName: sessionUser.nomComplet?.split(' ').slice(1).join(' ') ?? '', email: '', role: sessionUser.role })
      }
      const params = new URLSearchParams(window.location.search)
      const convId = params.get('conversationId')
      const targetSection = params.get('section')
      if (convId) {
        setSection('messagerie')
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('zekoulabia:open-conversation', { detail: { conversationId: convId } }))
        }, 150)
      } else if (targetSection && TEACHER_SECTIONS.includes(targetSection as TeacherSection)) {
        setSection(targetSection as TeacherSection)
      }
    } catch { /* silencieux — données absentes ou corrompues */ }

    if (currentUserId) {
      getUserSession(currentUserId).then(saved => {
        if (saved?.fullProfile) {
          setUser(saved.fullProfile as unknown as UserInfo)
        }
        if (saved?.schoolInfo) {
          setSchoolInfo(saved.schoolInfo)
        }
      }).catch(() => {})
    }

    const handleUserUpdated = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail) {
        setUser(prev => prev ? { ...prev, ...customEvent.detail } : customEvent.detail)
      }
    }
    window.addEventListener('zekoulabia:user-updated', handleUserUpdated)
    return () => window.removeEventListener('zekoulabia:user-updated', handleUserUpdated)
  }, [])

  // Infos école + utilisateur + compteur notes en attente — fetch en arrière-plan
  useEffect(() => {
    let uid = ''
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      if (raw) uid = (JSON.parse(raw) as SessionUser).userId
    } catch { /* ignore */ }

    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json()).then(d => {
        if (d.success && d.data) {
          setSchoolInfo(d.data)
          if (uid) {
            getUserSession(uid).then(existing => {
              putUserSession({
                userId: uid,
                role: 'TEACHER',
                nomComplet: existing?.nomComplet || '',
                firstName: existing?.firstName || '',
                permissions: existing?.permissions || [],
                fullProfile: existing?.fullProfile,
                schoolInfo: d.data,
                cachedAt: Date.now(),
              }).catch(() => {})
            }).catch(() => {})
          }
        }
      }).catch(() => {})

    fetchApi('/api/v2/users/me', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) {
          try { localStorage.removeItem('zekoulabia_user') } catch { /* ignore */ }
          router.replace('/login')
          return Promise.reject('auth')
        }
        return r.json()
      })
      .then(d => {
        if (d.success && d.data) {
          setUser(d.data)
          const fullUser = d.data as UserInfo
          getUserSession(fullUser.id).then(existing => {
            putUserSession({
              userId: fullUser.id,
              role: fullUser.role || 'TEACHER',
              nomComplet: `${fullUser.firstName || ''} ${fullUser.lastName || ''}`.trim(),
              firstName: fullUser.firstName || '',
              lastName: fullUser.lastName || '',
              permissions: [],
              fullProfile: fullUser,
              schoolInfo: existing?.schoolInfo,
              cachedAt: Date.now(),
            }).catch(() => {})
          }).catch(() => {})
        }
      })
      .catch(err => { if (err !== 'auth') console.warn('[teacher-dashboard] Erreur réseau:', err) })

    fetchApi('/api/v2/grades?validationStatus=SUBMITTED&limit=1', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.pagination) setPendingGrades(d.pagination.total ?? 0) }).catch(() => {})
  }, [router])

  // Préchargement exhaustif en tâche de fond pour l'autonomie hors-ligne complète
  useEffect(() => {
    if (!user || !navigator.onLine) return
    void prefetchTeacherOfflineData(user)
  }, [user])

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Navigation temps réel déclenchée par l'assistant IA (copilot)
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const navSection = (e as CustomEvent<{ section?: string }>).detail?.section
      if (navSection && TEACHER_SECTIONS.includes(navSection as TeacherSection)) setSection(navSection as TeacherSection)
    }
    window.addEventListener('zekoulabia:navigate', onNavigate)
    return () => window.removeEventListener('zekoulabia:navigate', onNavigate)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>
      <TeacherSidebar current={section} onChange={setSection} schoolName={schoolInfo?.name} logoUrl={schoolInfo?.logoUrl} onLogout={logoutUser} user={user} pendingGrades={pendingGrades} pendingCount={pendingCount} mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TeacherTopbar
          title={TITLES[section]}
          onMenuClick={() => setMobileNavOpen(true)}
          onChangePassword={() => setChangePwdOpen(true)}
          onNavigate={s => setSection(s as TeacherSection)}
          user={user}
          onLogout={logoutUser}
        />
        <ModeTestBanner />
        <EventCenterWidget />

        <TeacherMainContent
          section={section}
          visitedSections={visitedSections}
          user={user}
          selectedPPClassId={selectedPPClassId}
          selectedAPDeptId={selectedAPDeptId}
          onSelectSection={setSection}
          onSelectPPClass={setSelectedPPClassId}
          onSelectAPDept={setSelectedAPDeptId}
          showToast={showToast}
          tnav={tnav}
          tcommon={tcommon}
        />
      </div>

      <TeacherToast toasts={toasts} onRemove={removeToast} />
      <OfflineIndicator />
      {changePwdOpen && <ChangePasswordModal onClose={() => setChangePwdOpen(false)} onToast={showToast} />}
      <AssistantWidget section={section} rolePrefix="teacher" suggestions={TEACHER_ASSISTANT_SUGGESTIONS} />
      <TeacherBottomNav current={section} onChange={setSection} onOpenMenu={() => setMobileNavOpen(true)} pendingGrades={pendingGrades} />
    </div>
  )
}
