'use client'

import { useState, useCallback, useEffect } from 'react'
import { logoutUser } from '@/lib/userAuth'
import NotificationBell from '@/components/NotificationBell'
import MobileMenuButton from '@/components/MobileMenuButton'
import ParentSidebar from './_components/ParentSidebar'
import ParentToast from './_components/ParentToast'
import SoldeAlertBanner from './_components/SoldeAlertBanner'
import SectionParentChildren from './_components/SectionParentChildren'
import SectionParentGrades from './_components/SectionParentGrades'
import SectionParentAttendance from './_components/SectionParentAttendance'
import SectionParentPayments from './_components/SectionParentPayments'
import SectionParentAPEE from './_components/SectionParentAPEE'
import NotificationCenter from '@/components/NotificationCenter'
import SectionParentTimetable from './_components/SectionParentTimetable'
import SectionParentSettings from './_components/SectionParentSettings'
import SectionParentLibrary from './_components/SectionParentLibrary'
import type { ParentSection, Toast, UserInfo } from './_types'
import { fetchApi } from '@/lib/fetchApi'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import EventCenterWidget from '@/features/communication/EventCenterWidget'
import AssistantWidget from '../../admin/dashboard/_components/AssistantWidget'
import { useRouter } from 'next/navigation'
import Babillard from '@/features/communication/Babillard'
import Messagerie from '@/features/messagerie'

interface SessionUser {
  userId: string
  role: string
  nomComplet?: string
  firstName?: string
  permissions?: string[]
}

const PARENT_SECTIONS: ParentSection[] = ['children', 'grades', 'attendance', 'payments', 'timetable', 'settings', 'library', 'apee', 'notifications', 'babillard', 'messagerie']
const PARENT_ASSISTANT_SUGGESTIONS = [
  'Quelles sont les dernières notes de mon enfant ?',
  'Mon enfant a-t-il des factures impayées ?',
  'Quel est le taux de présence de mon enfant ce mois-ci ?',
]

let toastId = 0

interface SchoolInfo { name: string; logoUrl: string | null }

export default function ParentDashboard() {
  const tnav = useT('navigation')
  const router = useRouter()
  const TITLES: Record<ParentSection, string> = {
    children:   tnav('pageTitle.parent_children'),
    grades:     tnav('pageTitle.parent_grades'),
    attendance: tnav('pageTitle.parent_attendance'),
    payments:   tnav('pageTitle.parent_payments'),
    apee:       tnav('pageTitle.parent_apee'),
    notifications: tnav('pageTitle.parent_notifications'),
    timetable:  tnav('pageTitle.parent_timetable'),
    settings:   tnav('pageTitle.parent_settings'),
    library:    tnav('pageTitle.parent_library'),
    babillard:  tnav('sidebar.babillard'),
    messagerie: tnav('sidebar.messagerie'),
  }
  const [section, setSection] = useState<ParentSection>('children')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [user, setUser] = useState<UserInfo | null>(null)
  const [school, setSchool] = useState<SchoolInfo | null>(null)

  // Lecture session depuis localStorage (stockée au login) — identique à admin/staff/teacher
  useEffect(() => {
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      if (raw) {
        const sessionUser = JSON.parse(raw) as SessionUser
        setUser({ id: sessionUser.userId, firstName: sessionUser.firstName ?? '', lastName: sessionUser.nomComplet?.split(' ').slice(1).join(' ') ?? '', email: '', role: sessionUser.role })
      }
    } catch { /* silencieux — données absentes ou corrompues */ }
  }, [])

  // Infos école + utilisateur — fetch en arrière-plan
  useEffect(() => {
    fetchApi('/api/v2/users/me', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.replace('/login'); return Promise.reject('auth') }
        return r.json()
      })
      .then(d => { if (d.success) setUser(d.data) })
      .catch(err => { if (err !== 'auth') console.warn('[parent-dashboard] Erreur réseau:', err) })
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setSchool(d.data) }).catch(() => {})
  }, [router])

  useEffect(() => {
    if (!user || !navigator.onLine) return
    const uid = user.id
    ;(async () => {
      try {
        const childrenRes = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
        if (!childrenRes.success) return
        const children = childrenRes.data
        const now = Date.now()
        await putCachedData(`parent:children:${uid}`, children)
        await putCachedData(`parent:attendance:${uid}`, children)
        const rcRes = await fetchApi('/api/v2/report-cards', { credentials: 'include' }).then(r => r.json())
        await putCachedData(`parent:grades:${uid}`, { children, bulletins: rcRes.reportCards ?? [] })
      } catch { /* silent */ }
    })()
  }, [user])

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const sProps = { onToast: showToast }

  // Navigation temps réel déclenchée par l'assistant IA (copilot) : quand il répond à
  // une question, on bascule vers l'écran concerné pour que l'information soit visible.
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const navSection = (e as CustomEvent<{ section?: string }>).detail?.section
      if (navSection && PARENT_SECTIONS.includes(navSection as ParentSection)) setSection(navSection as ParentSection)
    }
    window.addEventListener('zekoulabia:navigate', onNavigate)
    return () => window.removeEventListener('zekoulabia:navigate', onNavigate)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>
      <ParentSidebar current={section} onChange={setSection} onLogout={logoutUser} user={user} school={school} mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <header style={{ height: 40, background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 16px', gap: 8, flexShrink: 0 }}>
          <MobileMenuButton onClick={() => setMobileNavOpen(true)} />
          <div className="truncate" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {TITLES[section]}
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            <NotificationBell onNav={s => setSection(s as ParentSection)} />
          </div>
        </header>
        <EventCenterWidget />
        <SoldeAlertBanner onNav={s => setSection(s as ParentSection)} />

        <main style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>
          {section === 'children'   && <SectionParentChildren onNav={s => setSection(s as ParentSection)} {...sProps} userId={user?.id} />}
          {section === 'grades'     && <SectionParentGrades {...sProps} userId={user?.id} />}
          {section === 'attendance' && <SectionParentAttendance {...sProps} userId={user?.id} />}
          {section === 'payments'   && <SectionParentPayments {...sProps} />}
          {section === 'apee'       && <SectionParentAPEE {...sProps} />}
          {section === 'notifications' && <NotificationCenter />}
          {section === 'timetable'  && <SectionParentTimetable {...sProps} userId={user?.id} />}
          {section === 'settings'   && <SectionParentSettings />}
          {section === 'library'    && <SectionParentLibrary userId={user?.id} />}
          {section === 'babillard' && <Babillard role={user?.role ?? 'PARENT'} title={tnav('sidebar.babillard')} subtitle={tnav('group.communication')} />}
          {section === 'messagerie' && <Messagerie />}
        </main>
      </div>

      <ParentToast toasts={toasts} onRemove={removeToast} />
      <OfflineIndicator />
      <AssistantWidget section={section} rolePrefix="parent" suggestions={PARENT_ASSISTANT_SUGGESTIONS} />
    </div>
  )
}
