'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { logoutUser } from '@/lib/userAuth'
import { fetchApi } from '@/lib/fetchApi'
import { getUserSession, putUserSession } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import EventCenterWidget from '@/features/communication/EventCenterWidget'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import ModeTestBanner from '@/components/ModeTestBanner'
import AdminSidebar from './_components/AdminSidebar'
import AdminTopbar from './_components/AdminTopbar'
import AdminBottomNav from './_components/AdminBottomNav'
import AdminToast from './_components/AdminToast'
import AssistantWidget from './_components/AssistantWidget'
import HighlightController from './_components/HighlightController'
import AnomaliesAlertBanner from './_components/AnomaliesAlertBanner'
import ClotureAnneeModal from './_components/ClotureAnneeModal'
import type { AdminSection, Toast } from './_types'
import { ADMIN_SECTIONS, type AdminBadges, type SchoolInfo, type SessionUser } from './pageParts/types'
import { useAdminOfflinePreload } from './pageParts/useAdminOfflinePreload'
import AdminMainSections from './pageParts/AdminMainSections'

let toastId = 0

export default function AdminDashboard() {
  const t = useT('admin')
  const router = useRouter()
  const [section, setSection] = useState<AdminSection>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo | null>(null)
  const [changePwdOpen, setChangePwdOpen] = useState(false)
  const [badges, setBadges] = useState<AdminBadges>({})
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)
  const [activeEventTypes, setActiveEventTypes] = useState<string[]>([])
  const [hasActiveEntranceExam, setHasActiveEntranceExam] = useState(false)
  const [hasActivePebs, setHasActivePebs] = useState(false)
  const [hasPendingGroupTransfers, setHasPendingGroupTransfers] = useState(false)
  const [clotureModalOpen, setClotureModalOpen] = useState(false)
  const [visitedSections, setVisitedSections] = useState<Set<AdminSection>>(() => new Set(['dashboard']))

  useEffect(() => {
    setVisitedSections(prev => {
      if (prev.has(section)) return prev
      const next = new Set(prev)
      next.add(section)
      return next
    })
  }, [section])

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(item => item.id !== id))
  }, [])

  useEffect(() => {
    let currentUserId = ''
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      if (raw) {
        const parsed = JSON.parse(raw) as SessionUser
        setSessionUser(parsed)
        currentUserId = parsed.userId ?? parsed.id ?? ''
      }
    } catch { /* ignore */ }

    if (currentUserId) {
      getUserSession(currentUserId).then(saved => {
        if (saved?.schoolInfo) {
          setSchoolInfo(saved.schoolInfo as SchoolInfo)
        }
      }).catch(() => {})
    }

    const handleUserUpdated = (e: Event) => {
      const customEvent = e as CustomEvent
      if (customEvent.detail) {
        setSessionUser(prev => prev ? { ...prev, ...customEvent.detail } : customEvent.detail)
      }
    }
    window.addEventListener('zekoulabia:user-updated', handleUserUpdated)

    fetchApi('/api/v2/school/me')
      .then(r => {
        if (r.status === 401) {
          try { localStorage.removeItem('zekoulabia_user') } catch { /* ignore */ }
          router.replace('/login')
          return Promise.reject('auth')
        }
        return r.json()
      })
      .then(d => {
        if (!d || !d.success || !d.data) return
        const { status } = d.data as { status: string }
        if (status === 'APPROVED') { router.replace('/admin/configuration'); return }
        if (status !== 'ACTIVE') {
          try { localStorage.removeItem('zekoulabia_user') } catch { /* ignore */ }
          router.replace('/login')
          return
        }
        setSchoolInfo(d.data)

        if (currentUserId) {
          putUserSession({
            userId: currentUserId,
            role: 'ADMIN',
            nomComplet: '',
            firstName: '',
            permissions: [],
            schoolInfo: d.data,
            cachedAt: Date.now(),
          }).catch(() => {})
        }

        const params = new URLSearchParams(window.location.search)
        if (params.get('activated') === '1') {
          showToast(t('page.toast.welcome_active'), 'success')
          window.history.replaceState(null, '', '/admin/dashboard')
        }
        const targetSection = params.get('section')
        const convId = params.get('conversationId')
        if (convId) {
          setSection('messagerie')
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('zekoulabia:open-conversation', { detail: { conversationId: convId } }))
          }, 150)
        } else if (targetSection && ADMIN_SECTIONS.includes(targetSection as AdminSection)) {
          setSection(targetSection as AdminSection)
        }
      })
      .catch(err => { if (err !== 'auth') console.warn('[dashboard] Erreur réseau:', err) })

    fetchApi('/api/v2/dashboard/admin-badges')
      .then(r => r.json())
      .then(d => {
        if (!d.success) return
        const { users, classes, pendingInvoices, pendingOnboardings } = d.data as { users: number; classes: number; pendingGrades: number; pendingInvoices: number; pendingOnboardings?: number }
        setBadges({
          users: users > 0 ? String(users) : undefined,
          classes: classes > 0 ? String(classes) : undefined,
          grades: undefined,
          finance: pendingInvoices > 0 ? String(pendingInvoices) : undefined,
          'eleve-onboarding': (pendingOnboardings && pendingOnboardings > 0) ? String(pendingOnboardings) : undefined,
        })
      })
      .catch(() => {})

    fetchApi('/api/v2/academic-events/active')
      .then(r => r.json())
      .then(d => { if (d.success) setActiveEventTypes((d.data || []).map((e: { type: string }) => e.type)) })
      .catch(() => {})

    fetchApi('/api/v2/entrance-exams')
      .then(r => r.json())
      .then(d => { if (d.success) setHasActiveEntranceExam((d.data || []).some((s: { status: string }) => s.status !== 'CLOSED')) })
      .catch(() => {})

    fetchApi('/api/v2/pebs-exams')
      .then(r => r.json())
      .then(d => { if (d.success) setHasActivePebs((d.data || []).some((s: { status: string }) => s.status !== 'APPLIED')) })
      .catch(() => {})

    fetchApi('/api/v2/group-transfers/incoming')
      .then(r => r.json())
      .then(d => { if (d.success) setHasPendingGroupTransfers((d.data || []).length > 0) })
      .catch(() => {})

    return () => window.removeEventListener('zekoulabia:user-updated', handleUserUpdated)
  }, [router, showToast, t])

  useAdminOfflinePreload(sessionUser)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.push('/login')
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [router])

  useEffect(() => {
    const onNavigate = (e: Event) => {
      const target = (e as CustomEvent<{ section?: string }>).detail?.section
      if (target && ADMIN_SECTIONS.includes(target as AdminSection)) setSection(target as AdminSection)
    }
    window.addEventListener('zekoulabia:navigate', onNavigate)
    return () => window.removeEventListener('zekoulabia:navigate', onNavigate)
  }, [])

  useEffect(() => {
    const onOpenCloture = () => setClotureModalOpen(true)
    window.addEventListener('zekoulabia:open-cloture-modal', onOpenCloture)
    return () => window.removeEventListener('zekoulabia:open-cloture-modal', onOpenCloture)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-nunito),Nunito,sans-serif', background: 'var(--bg)' }}>
      <AdminSidebar
        current={section}
        onChange={setSection}
        schoolName={schoolInfo?.name}
        logoUrl={schoolInfo?.logoUrl}
        onLogout={logoutUser}
        badges={badges}
        sessionUser={sessionUser}
        activeEventTypes={activeEventTypes}
        hasActiveEntranceExam={hasActiveEntranceExam}
        hasActivePebs={hasActivePebs}
        hasPendingGroupTransfers={hasPendingGroupTransfers}
        isPrimaire={schoolInfo?.isPrimaire}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <AdminTopbar
          title={t(`page.section_titles.${section}`)}
          onNavigate={s => setSection(s as AdminSection)}
          onChangePassword={() => setChangePwdOpen(true)}
          onMenuClick={() => setMobileNavOpen(true)}
          sessionUser={sessionUser}
          onLogout={logoutUser}
        />
        <ModeTestBanner />
        <EventCenterWidget onNav={s => setSection(s as AdminSection)} />
        <AnomaliesAlertBanner onNav={s => setSection(s as AdminSection)} />

        <AdminMainSections
          section={section}
          visitedSections={visitedSections}
          setSection={setSection}
          showToast={showToast}
          schoolInfo={schoolInfo}
          onLogoUpdate={url => setSchoolInfo(s => (s ? { ...s, logoUrl: url } : null))}
          sessionUser={sessionUser}
        />
      </div>

      <AdminToast toasts={toasts} onRemove={removeToast} />
      <AssistantWidget section={section} />
      <HighlightController />
      <OfflineIndicator />
      {changePwdOpen && <ChangePasswordModal onClose={() => setChangePwdOpen(false)} onToast={showToast} />}
      <ClotureAnneeModal
        isOpen={clotureModalOpen}
        onClose={() => setClotureModalOpen(false)}
        onToast={showToast}
        onSuccess={() => {
          showToast("Transition d'année effectuée avec succès", 'success')
          window.location.reload()
        }}
      />
      <AdminBottomNav current={section} onChange={setSection} onOpenMenu={() => setMobileNavOpen(true)} />
    </div>
  )
}
