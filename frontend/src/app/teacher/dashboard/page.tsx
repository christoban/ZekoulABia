'use client'

import { useState, useCallback, useEffect } from 'react'
import { Search, KeyRound, FileText, FolderOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { logoutUser } from '@/lib/userAuth'
import MobileMenuButton from '@/components/MobileMenuButton'
import TeacherSidebar from './_components/TeacherSidebar'
import TeacherToast from './_components/TeacherToast'
import SectionTeacherDashboard from './_components/SectionTeacherDashboard'
import SectionTeacherClasses from './_components/SectionTeacherClasses'
import SectionTeacherAttendance from './_components/SectionTeacherAttendance'
import SectionTeacherGrades from './_components/SectionTeacherGrades'
import SectionTeacherTimetable from './_components/SectionTeacherTimetable'
import SectionProfesseurPrincipal from './_components/SectionProfesseurPrincipal'
import SectionAppreciationsPP from './_components/SectionAppreciationsPP'
import SectionDepartementAP from './_components/SectionDepartementAP'
import SectionCahierDeTexte from './_components/SectionCahierDeTexte'
import SectionTeacherAtRisk from './_components/SectionTeacherAtRisk'
import SectionMesActionsSuivi from './_components/SectionMesActionsSuivi'
import SectionTeacherCorrectionAnonyme from './_components/SectionTeacherCorrectionAnonyme'
import type { TeacherSection, Toast, UserInfo } from './_types'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import SectionMonProfilRH from '@/features/rh/SectionMonProfilRH'
import NotificationBell from '@/components/NotificationBell'
import NotificationCenter from '@/components/NotificationCenter'
import AssistantWidget from '../../admin/dashboard/_components/AssistantWidget'
import EventCenterWidget from '@/features/communication/EventCenterWidget'
import { useT } from '@/lib/i18n'
import { useRouter } from 'next/navigation'
import Babillard from '@/features/communication/Babillard'
import Messagerie from '@/features/messagerie'
import SectionOfflineStatus from '@/components/SectionOfflineStatus'

interface SessionUser {
  userId: string
  role: string
  nomComplet?: string
  firstName?: string
  permissions?: string[]
}

const TEACHER_SECTIONS: TeacherSection[] = [
  'dashboard', 'classes', 'attendance', 'grades', 'bulletins', 'timetable', 'resources', 'sync',
  'pp-classe', 'pp-appreciations', 'ap-departement', 'cahier-de-texte', 'at-risk', 'mon-suivi',
  'correction-anonyme',
  'mon-profil-rh', 'notifications', 'babillard', 'messagerie',
]
const TEACHER_ASSISTANT_SUGGESTIONS = [
  'Donne 15 à Jean Dupont en maths pour la 4eA',
  'Marque Awa absente aujourd’hui en 3eB',
  'Quelle est la moyenne de ma 4eA en maths ?',
]

let toastId = 0

const PLACEHOLDERS: Partial<Record<TeacherSection, { icon: LucideIcon }>> = {
  bulletins: { icon: FileText },
  resources: { icon: FolderOpen },
}

export default function TeacherDashboard() {
  const tnav = useT('navigation')
  const tcommon = useT('common')
  const router = useRouter()
  const TITLES: Record<TeacherSection, string> = {
    dashboard:           tnav('pageTitle.teacher_dashboard'),
    classes:             tnav('pageTitle.teacher_classes'),
    attendance:          tnav('pageTitle.teacher_attendance'),
    grades:              tnav('pageTitle.teacher_grades'),
    bulletins:           tnav('pageTitle.teacher_bulletins'),
    timetable:           tnav('pageTitle.teacher_timetable'),
    resources:           tnav('pageTitle.teacher_resources'),
    sync:                tnav('pageTitle.teacher_sync'),
    'pp-classe':         tnav('pageTitle.teacher_ppClasse'),
    'pp-appreciations':  tnav('pageTitle.teacher_ppAppreciations'),
    'ap-departement':    tnav('pageTitle.teacher_apDepartement'),
    'cahier-de-texte':   tnav('pageTitle.teacher_cahierDeTexte'),
    'at-risk':           tnav('pageTitle.teacher_atRisk'),
    'mon-suivi':         tnav('pageTitle.teacher_monSuivi'),
    'correction-anonyme': tnav('pageTitle.teacher_correctionAnonyme'),
    'mon-profil-rh':     tnav('sidebar.monProfilRH'),
    notifications:       tnav('pageTitle.teacher_notifications'),
    babillard:           tnav('sidebar.babillard'),
    messagerie:          tnav('sidebar.messagerie'),
  }
  const [section, setSection] = useState<TeacherSection>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logoUrl: string | null } | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [pendingGrades, setPendingGrades] = useState<number>(0)
  const [changePwdOpen, setChangePwdOpen] = useState(false)
  const { pendingCount } = useSyncQueue()

  // Lecture session depuis localStorage (stockée au login) — identique à admin/staff
  useEffect(() => {
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      if (raw) {
        const sessionUser = JSON.parse(raw) as SessionUser
        setUser({ id: sessionUser.userId, firstName: sessionUser.firstName ?? '', lastName: sessionUser.nomComplet?.split(' ').slice(1).join(' ') ?? '', email: '', role: sessionUser.role })
      }
    } catch { /* silencieux — données absentes ou corrompues */ }
  }, [])

  // Infos école + utilisateur + compteur notes en attente — fetch en arrière-plan
  useEffect(() => {
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setSchoolInfo(d.data) }).catch(() => {})
    fetchApi('/api/v2/users/me', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) { router.replace('/login'); return Promise.reject('auth') }
        return r.json()
      })
      .then(d => { if (d.success) setUser(d.data) })
      .catch(err => { if (err !== 'auth') console.warn('[teacher-dashboard] Erreur réseau:', err) })
    fetchApi('/api/v2/grades?validationStatus=SUBMITTED&limit=1', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.pagination) setPendingGrades(d.pagination.total ?? 0) }).catch(() => {})
  }, [router])

  const showToast = useCallback((msg: string, type: Toast['type'] = 'success') => {
    const id = ++toastId
    setToasts(prev => [...prev, { id, msg, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const sProps = { onToast: showToast, user }

  // Navigation temps réel déclenchée par l'assistant IA (copilot) : quand il exécute
  // une action, on bascule vers l'écran concerné pour que le changement soit visible.
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
        {/* Topbar */}
        <header style={{ height: 68, background: 'var(--surface)', borderBottom: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 32px', gap: 14, flexShrink: 0 }}>
          <MobileMenuButton onClick={() => setMobileNavOpen(true)} />
          <div className="truncate" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 22, fontWeight: 700, color: 'var(--text)' }}>
            {TITLES[section]}
          </div>
          <span className="hidden lg:inline" style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 20, padding: '4px 14px', fontSize: 15, fontWeight: 700, color: 'var(--text3)' }}>
            Trimestre 2 · Séquence 3
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="hidden sm:block" style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input placeholder={tcommon('actions.search') + '...'} style={{ background: 'var(--bg2)', border: '1.5px solid var(--border)', borderRadius: 10, padding: '8px 14px 8px 34px', fontSize: 15, fontWeight: 600, color: 'var(--text)', outline: 'none', width: 260, fontFamily: 'inherit' }} />
            </div>
            <button onClick={() => setChangePwdOpen(true)} title={tcommon('auth.changePassword')}
              style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--bg2)', border: '1.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <KeyRound size={18} color="var(--text2)" />
            </button>
            <NotificationBell onNav={s => setSection(s as TeacherSection)} />
          </div>
        </header>
        <EventCenterWidget />

        {/* Contenu */}
        <main style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>
          {section === 'dashboard'  && <SectionTeacherDashboard onNav={s => setSection(s as TeacherSection)} {...sProps} />}
          {section === 'classes'    && <SectionTeacherClasses onNav={s => setSection(s as TeacherSection)} {...sProps} />}
          {section === 'attendance' && <SectionTeacherAttendance {...sProps} />}
          {section === 'grades'     && <SectionTeacherGrades {...sProps} />}

          {section === 'timetable'  && <SectionTeacherTimetable {...sProps} />}
          {section === 'sync'       && <SectionOfflineStatus onToast={showToast} namespace="teacher" />}
          {section === 'pp-classe' && (() => {
            const cls = user?.classesProfessorPrincipal?.[0]
            return cls ? <SectionProfesseurPrincipal user={user!} classeId={cls.id} classeNom={cls.name} /> : null
          })()}
          {section === 'pp-appreciations' && (() => {
            const cls = user?.classesProfessorPrincipal?.[0]
            return cls ? <SectionAppreciationsPP user={user!} classeId={cls.id} /> : null
          })()}
          {section === 'ap-departement' && (() => {
            const dept = user?.headedDepartments?.[0]
            return dept ? <SectionDepartementAP user={user!} departementId={dept.id} departementNom={dept.name} /> : null
          })()}
          {section === 'cahier-de-texte' && <SectionCahierDeTexte user={user} onToast={showToast} />}
          {section === 'at-risk' && user && <SectionTeacherAtRisk currentUserId={user.id} onToast={showToast} />}
          {section === 'mon-suivi' && <SectionMesActionsSuivi onToast={showToast} />}
          {section === 'correction-anonyme' && <SectionTeacherCorrectionAnonyme onToast={showToast} />}
          {section === 'mon-profil-rh' && <SectionMonProfilRH onToast={showToast} />}
          {section === 'notifications' && <NotificationCenter />}
          {section === 'babillard' && <Babillard role={user?.role ?? 'TEACHER'} title={tnav('sidebar.babillard')} subtitle={tcommon('brand.roleTeacher')} />}
          {section === 'messagerie' && <Messagerie />}
          {Object.entries(PLACEHOLDERS).map(([key, val]) =>
            section === key ? (
              <div key={key} style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1.5px solid var(--border)', padding: 48, textAlign: 'center', maxWidth: 400 }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><val.icon size={48} /></div>
                  <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
                    {TITLES[key as TeacherSection]}
                  </div>
                  <div style={{ fontSize: 14, color: 'var(--text3)', fontWeight: 500 }}>
                    Section en cours de développement
                  </div>
                </div>
              </div>
            ) : null
          )}
        </main>
      </div>

      <TeacherToast toasts={toasts} onRemove={removeToast} />
      <OfflineIndicator />
      {changePwdOpen && <ChangePasswordModal onClose={() => setChangePwdOpen(false)} onToast={showToast} />}
      <AssistantWidget section={section} rolePrefix="teacher" suggestions={TEACHER_ASSISTANT_SUGGESTIONS} />
    </div>
  )
}
