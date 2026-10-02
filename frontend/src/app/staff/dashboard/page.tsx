'use client'

import { useState, useCallback, useEffect } from 'react'
import type { StaffSection, SessionUser, Toast } from './_types'
import { getSectionsFromPermissions } from './_types'

import StaffSidebar     from './_components/StaffSidebar'
import StaffTopbar      from './_components/StaffTopbar'
import StaffBottomNav   from './_components/StaffBottomNav'
import StaffToast       from './_components/StaffToast'
import { logoutUser }   from '@/lib/userAuth'
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
import SectionClassesStaff from './_components/SectionClassesStaff'
import SectionElevesAffectationsStaff from './_components/SectionElevesAffectationsStaff'
import SectionImportElevesStaff from './_components/SectionImportElevesStaff'
import SectionInscriptionsStaff from './_components/SectionInscriptionsStaff'
import SectionConcoursStaff from './_components/SectionConcoursStaff'
import SectionConfigurationStaff from './_components/SectionConfigurationStaff'
import SectionRapportsStaff from './_components/SectionRapportsStaff'
import SectionElevesFamillesStaff from './_components/SectionElevesFamillesStaff'
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
  const [toasts, setToasts]             = useState<Toast[]>([])
  const [sessionUser, setSessionUser]   = useState<SessionUser | null>(null)
  const [allowedSections, setAllowedSections] = useState<Set<StaffSection>>(new Set(['dashboard', 'mon-profil-rh', 'notifications', 'babillard', 'messagerie', 'moderation-messagerie', 'sync-offline', 'configuration']))
  const [schoolName, setSchoolName]     = useState<string | undefined>(undefined)
  const [logoUrl,    setLogoUrl]        = useState<string | null>(null)
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

  // Lecture session depuis localStorage (stockée au login)
  useEffect(() => {
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      if (raw) {
        const user = JSON.parse(raw) as SessionUser
        setSessionUser(user)
        const allowed = getSectionsFromPermissions(user.permissions ?? [])
        setAllowedSections(allowed)

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
        hasActiveEntranceExam={hasActiveEntranceExam}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <StaffTopbar
          section={section}
          onChangePassword={() => setChangePwdOpen(true)}
          onNav={s => navTo(s as StaffSection)}
          onMenuClick={() => setMobileNavOpen(true)}
          sessionUser={sessionUser}
          onLogout={logoutUser}
        />
        <EventCenterWidget />
        <APEEAlertBanner visible={can('apee')} onNav={s => navTo(s as StaffSection)} />

        <main className="pb-[calc(68px+env(safe-area-inset-bottom,0px))] md:pb-0" style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>

          <div style={{ display: section === 'dashboard' ? 'contents' : 'none' }}>
            <SectionStaffDashboard
              sessionUser={sessionUser}
              allowedSections={allowedSections}
              onNav={navTo}
              onToast={showToast}
            />
          </div>

          {visitedSections.has('inscriptions') && can('inscriptions') && (
            <div style={{ display: section === 'inscriptions' ? 'contents' : 'none' }}>
              <SectionInscriptionsStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('concours') && can('concours') && (
            <div style={{ display: section === 'concours' ? 'contents' : 'none' }}>
              <SectionConcoursStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('eleves-familles') && can('eleves-familles') && (
            <div style={{ display: section === 'eleves-familles' ? 'contents' : 'none' }}>
              <SectionElevesFamillesStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('council') && can('council') && (
            <div style={{ display: section === 'council' ? 'contents' : 'none' }}>
              <SectionCouncil onToast={showToast} />
            </div>
          )}

          {visitedSections.has('anonymat') && can('anonymat') && (
            <div style={{ display: section === 'anonymat' ? 'contents' : 'none' }}>
              <SectionAnonymatStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('attendance') && can('attendance') && (
            <div style={{ display: section === 'attendance' ? 'contents' : 'none' }}>
              <SectionAttendanceStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('eleves-affectations') && can('eleves-affectations') && (
            <div style={{ display: section === 'eleves-affectations' ? 'contents' : 'none' }}>
              <SectionElevesAffectationsStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('timetable') && can('timetable') && (
            <div style={{ display: section === 'timetable' ? 'contents' : 'none' }}>
              <SectionTimetableStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('finance') && can('finance') && (
            <div style={{ display: section === 'finance' ? 'contents' : 'none' }}>
              <SectionFinanceStaff onToast={showToast} sessionUser={sessionUser} />
            </div>
          )}

          {visitedSections.has('apee') && can('apee') && (
            <div style={{ display: section === 'apee' ? 'contents' : 'none' }}>
              <SectionAPEEStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('discipline') && can('discipline') && (
            <div style={{ display: section === 'discipline' ? 'contents' : 'none' }}>
              <SectionDiscipline onToast={showToast} />
            </div>
          )}

          {visitedSections.has('library') && can('library') && (
            <div style={{ display: section === 'library' ? 'contents' : 'none' }}>
              <SectionLibrary onToast={showToast} />
            </div>
          )}

          {visitedSections.has('orientation') && can('orientation') && (
            <div style={{ display: section === 'orientation' ? 'contents' : 'none' }}>
              <SectionOrientation onToast={showToast} />
            </div>
          )}

          {visitedSections.has('departements') && can('departements') && (
            <div style={{ display: section === 'departements' ? 'contents' : 'none' }}>
              <SectionDepartementsStaff onToast={showToast} />
            </div>
          )}

          {visitedSections.has('suivi-eleves') && can('suivi-eleves') && (
            <div style={{ display: section === 'suivi-eleves' ? 'contents' : 'none' }}>
              <SectionSuiviElevesStaff sessionUser={sessionUser} onToast={showToast} />
            </div>
          )}

          {visitedSections.has('configuration') && (
            <div style={{ display: (section === 'configuration' || ['import-eleves', 'classes', 'grille-horaire', 'affectations', 'cautions'].includes(section)) ? 'contents' : 'none' }}>
              <SectionConfigurationStaff
                onToast={showToast}
                allowedSections={allowedSections}
                initialTab={['import-eleves', 'classes', 'grille-horaire', 'affectations', 'cautions'].includes(section) ? section : undefined}
              />
            </div>
          )}

          {visitedSections.has('rapports') && can('rapports') && (
            <div style={{ display: section === 'rapports' ? 'contents' : 'none' }}>
              <SectionRapportsStaff />
            </div>
          )}

          {visitedSections.has('mon-profil-rh') && (
            <div style={{ display: section === 'mon-profil-rh' ? 'contents' : 'none' }}>
              <SectionMonProfilRH onToast={showToast} />
            </div>
          )}
          {visitedSections.has('notifications') && (
            <div style={{ display: section === 'notifications' ? 'contents' : 'none' }}>
              <NotificationCenter onNav={s => setSection(s as StaffSection)} />
            </div>
          )}
          {visitedSections.has('sync-offline') && (
            <div style={{ display: section === 'sync-offline' ? 'contents' : 'none' }}>
              <SectionOfflineStatus onToast={showToast} namespace="staff" />
            </div>
          )}
          {visitedSections.has('babillard') && (
            <div style={{ display: section === 'babillard' ? 'contents' : 'none' }}>
              <Babillard role={sessionUser?.role ?? 'STAFF'} title={tnav('sidebar.babillard')} subtitle={tnav('group.communication')} currentUserId={sessionUser?.userId} />
            </div>
          )}
          {visitedSections.has('messagerie') && (
            <div style={{ display: section === 'messagerie' ? 'contents' : 'none' }}>
              <Messagerie />
            </div>
          )}
          {visitedSections.has('moderation-messagerie') && (
            <div style={{ display: section === 'moderation-messagerie' ? 'contents' : 'none' }}>
              <SectionModerationMessagerie onToast={showToast} />
            </div>
          )}

        </main>
      </div>

      <StaffToast toasts={toasts} onRemove={removeToast} />
      <OfflineIndicator />
      {changePwdOpen && <ChangePasswordModal onClose={() => setChangePwdOpen(false)} onToast={showToast} />}
      <AssistantWidget section={section} rolePrefix="staff" suggestions={STAFF_ASSISTANT_SUGGESTIONS} />
      <StaffBottomNav current={section} onChange={navTo} allowedSections={allowedSections} onOpenMenu={() => setMobileNavOpen(true)} hasActiveEntranceExam={hasActiveEntranceExam} />
    </div>
  )
}
