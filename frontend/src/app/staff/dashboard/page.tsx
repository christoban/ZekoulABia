'use client'

import { useState, useCallback, useEffect } from 'react'
import type { StaffSection, SessionUser, Toast } from './_types'
import { getSectionsFromPermissions } from './_types'

import StaffSidebar     from './_components/StaffSidebar'
import StaffTopbar      from './_components/StaffTopbar'
import StaffToast       from './_components/StaffToast'
import SectionStaffDashboard   from './_components/SectionStaffDashboard'
import SectionCouncil          from './_components/SectionCouncil'
import SectionBulletinValidation  from './_components/SectionBulletinValidation'
import SectionAttendanceStaff  from './_components/SectionAttendanceStaff'
import SectionGrilleHoraire    from './_components/SectionGrilleHoraire'
import SectionAffectations     from './_components/SectionAffectations'
import SectionTimetableStaff   from './_components/SectionTimetableStaff'
import SectionFinanceStaff     from './_components/SectionFinanceStaff'
import SectionAPEEStaff        from './_components/SectionAPEEStaff'
import SectionCautions         from './_components/SectionCautions'
import SectionDiscipline       from './_components/SectionDiscipline'
import SectionLibrary          from './_components/SectionLibrary'
import SectionOrientation      from './_components/SectionOrientation'
import SectionDepartementsStaff from './_components/SectionDepartementsStaff'
import SectionSuiviElevesStaff from './_components/SectionSuiviElevesStaff'
import SectionAnonymatStaff from './_components/SectionAnonymatStaff'
import APEEAlertBanner from './_components/APEEAlertBanner'
import SectionMonProfilRH from '@/features/rh/SectionMonProfilRH'
import NotificationCenter from '@/components/NotificationCenter'
import { fetchApi } from '@/lib/fetchApi'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import EventCenterWidget from '@/features/communication/EventCenterWidget'
import AssistantWidget from '../../admin/dashboard/_components/AssistantWidget'
import SectionOfflineStatus from '@/components/SectionOfflineStatus'
import Babillard from '@/features/communication/Babillard'
import Messagerie from '@/features/messagerie'
import SectionModerationMessagerie from './_components/SectionModerationMessagerie'
import { useRouter } from 'next/navigation'
import { useT } from '@/lib/i18n'

const STAFF_ASSISTANT_SUGGESTIONS = [
  'Enregistre un avertissement écrit à Paul pour bavardage',
  "Quel est le solde de l'APEE ?",
  'Quels livres sont disponibles sur la géographie ?',
]

let toastId = 0

export default function StaffDashboard() {
  const router = useRouter()
  const tnav = useT('navigation')
  const [section, setSection]           = useState<StaffSection>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toasts, setToasts]             = useState<Toast[]>([])
  const [sessionUser, setSessionUser]   = useState<SessionUser | null>(null)
  const [allowedSections, setAllowedSections] = useState<Set<StaffSection>>(new Set(['dashboard', 'mon-profil-rh', 'notifications', 'babillard', 'messagerie', 'moderation-messagerie']))
  const [schoolName, setSchoolName]     = useState<string | undefined>(undefined)
  const [logoUrl,    setLogoUrl]        = useState<string | null>(null)
  const [changePwdOpen, setChangePwdOpen] = useState(false)

  // Lecture session depuis localStorage (stockée au login)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      if (raw) {
        const user = JSON.parse(raw) as SessionUser
        setSessionUser(user)
        setAllowedSections(getSectionsFromPermissions(user.permissions ?? []))
      }
    } catch { /* silencieux — données absentes ou corrompues */ }
  }, [])

  // Infos école depuis l'API
  useEffect(() => {
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.replace('/login'); return Promise.reject('auth') }
        return r.json()
      })
      .then(d => { if (d.success) { setSchoolName(d.data.name); setLogoUrl(d.data.logoUrl ?? null) } })
      .catch(err => { if (err !== 'auth') console.warn('[staff-dashboard] Erreur réseau:', err) })
  }, [router])

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

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>

      <StaffSidebar
        current={section}
        onChange={navTo}
        allowedSections={allowedSections}
        sessionUser={sessionUser}
        schoolName={schoolName}
        logoUrl={logoUrl}
        mobileOpen={mobileNavOpen}
        onMobileClose={() => setMobileNavOpen(false)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <StaffTopbar section={section} onChangePassword={() => setChangePwdOpen(true)} onNav={s => navTo(s as StaffSection)} onMenuClick={() => setMobileNavOpen(true)} />
        <EventCenterWidget />
        <APEEAlertBanner visible={can('apee')} onNav={s => navTo(s as StaffSection)} />

        <main style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>

          {section === 'dashboard' && (
            <SectionStaffDashboard
              sessionUser={sessionUser}
              allowedSections={allowedSections}
              onNav={navTo}
              onToast={showToast}
            />
          )}

          {section === 'council' && can('council') && (
            <SectionCouncil onToast={showToast} />
          )}

          {section === 'grades' && can('grades') && (
            <SectionBulletinValidation onToast={showToast} />
          )}

          {section === 'anonymat' && can('anonymat') && (
            <SectionAnonymatStaff onToast={showToast} sessionUser={sessionUser} />
          )}

          {section === 'attendance' && can('attendance') && (
            <SectionAttendanceStaff onToast={showToast} />
          )}

          {section === 'grille-horaire' && can('grille-horaire') && (
            <SectionGrilleHoraire onToast={showToast} />
          )}

          {section === 'affectations' && can('affectations') && (
            <SectionAffectations onToast={showToast} />
          )}

          {section === 'timetable' && can('timetable') && (
            <SectionTimetableStaff onToast={showToast} />
          )}

          {section === 'finance' && can('finance') && (
            <SectionFinanceStaff onToast={showToast} sessionUser={sessionUser} />
          )}

          {section === 'apee' && can('apee') && (
            <SectionAPEEStaff onToast={showToast} />
          )}

          {section === 'cautions' && can('cautions') && (
            <SectionCautions onToast={showToast} />
          )}

          {section === 'discipline' && can('discipline') && (
            <SectionDiscipline onToast={showToast} />
          )}

          {section === 'library' && can('library') && (
            <SectionLibrary onToast={showToast} />
          )}

          {section === 'orientation' && can('orientation') && (
            <SectionOrientation onToast={showToast} />
          )}

          {section === 'departements' && can('departements') && (
            <SectionDepartementsStaff onToast={showToast} />
          )}

          {section === 'suivi-eleves' && can('suivi-eleves') && (
            <SectionSuiviElevesStaff sessionUser={sessionUser} onToast={showToast} />
          )}

          {section === 'mon-profil-rh' && <SectionMonProfilRH onToast={showToast} />}
          {section === 'notifications' && <NotificationCenter />}
          {section === 'sync-offline' && <SectionOfflineStatus onToast={showToast} namespace="staff" />}
          {section === 'babillard' && <Babillard role={sessionUser?.role ?? 'STAFF'} title={tnav('sidebar.babillard')} subtitle={tnav('group.communication')} />}
          {section === 'messagerie' && <Messagerie />}
          {section === 'moderation-messagerie' && <SectionModerationMessagerie onToast={showToast} />}

        </main>
      </div>

      <StaffToast toasts={toasts} onRemove={removeToast} />
      <OfflineIndicator />
      {changePwdOpen && <ChangePasswordModal onClose={() => setChangePwdOpen(false)} onToast={showToast} />}
      <AssistantWidget section={section} rolePrefix="staff" suggestions={STAFF_ASSISTANT_SUGGESTIONS} />
    </div>
  )
}
