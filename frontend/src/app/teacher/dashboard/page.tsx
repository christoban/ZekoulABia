'use client'

import { useState, useCallback, useEffect } from 'react'
import { FileText, FolderOpen } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { logoutUser } from '@/lib/userAuth'
import TeacherSidebar from './_components/TeacherSidebar'
import TeacherTopbar from './_components/TeacherTopbar'
import TeacherBottomNav from './_components/TeacherBottomNav'
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
    dashboard: tnav('pageTitle.teacher_dashboard'),
    classes: tnav('pageTitle.teacher_classes'),
    attendance: tnav('pageTitle.teacher_attendance'),
    grades: tnav('pageTitle.teacher_grades'),
    bulletins: tnav('pageTitle.teacher_bulletins'),
    timetable: tnav('pageTitle.teacher_timetable'),
    resources: tnav('pageTitle.teacher_resources'),
    sync: tnav('pageTitle.teacher_sync'),
    'pp-classe': tnav('pageTitle.teacher_ppClasse'),
    'pp-appreciations': tnav('pageTitle.teacher_ppAppreciations'),
    'ap-departement': tnav('pageTitle.teacher_apDepartement'),
    'cahier-de-texte': tnav('pageTitle.teacher_cahierDeTexte'),
    'at-risk': tnav('pageTitle.teacher_atRisk'),
    'mon-suivi': tnav('pageTitle.teacher_monSuivi'),
    'correction-anonyme': tnav('pageTitle.teacher_correctionAnonyme'),
    'mon-profil-rh': tnav('sidebar.monProfilRH'),
    notifications: tnav('pageTitle.teacher_notifications'),
    babillard: tnav('sidebar.babillard'),
    messagerie: tnav('sidebar.messagerie'),
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
  }, [])

  // Infos école + utilisateur + compteur notes en attente — fetch en arrière-plan
  useEffect(() => {
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.success) setSchoolInfo(d.data) }).catch(() => { })
    fetchApi('/api/v2/users/me', { credentials: 'include' })
      .then(r => {
        if (r.status === 401) {
          try { localStorage.removeItem('zekoulabia_user') } catch { /* ignore */ }
          router.replace('/login')
          return Promise.reject('auth')
        }
        return r.json()
      })
      .then(d => { if (d.success) setUser(d.data) })
      .catch(err => { if (err !== 'auth') console.warn('[teacher-dashboard] Erreur réseau:', err) })
    fetchApi('/api/v2/grades?validationStatus=SUBMITTED&limit=1', { credentials: 'include' })
      .then(r => r.json()).then(d => { if (d.pagination) setPendingGrades(d.pagination.total ?? 0) }).catch(() => { })
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
        {/* Topbar — pattern Admin (identique admin/staff) */}
        <TeacherTopbar
          title={TITLES[section]}
          onMenuClick={() => setMobileNavOpen(true)}
          onChangePassword={() => setChangePwdOpen(true)}
          onNavigate={s => setSection(s as TeacherSection)}
          user={user}
          onLogout={logoutUser}
        />
        <EventCenterWidget />

        {/* Contenu */}
        <main className="pb-[calc(60px+env(safe-area-inset-bottom,0px))] md:pb-0" style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>
          {section === 'dashboard' && <SectionTeacherDashboard onNav={s => setSection(s as TeacherSection)} {...sProps} />}
          {section === 'classes' && <SectionTeacherClasses onNav={s => setSection(s as TeacherSection)} {...sProps} />}
          {section === 'attendance' && <SectionTeacherAttendance {...sProps} />}
          {section === 'grades' && <SectionTeacherGrades {...sProps} />}

          {section === 'timetable' && <SectionTeacherTimetable {...sProps} />}
          {section === 'sync' && <SectionOfflineStatus onToast={showToast} namespace="teacher" />}
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
          {section === 'notifications' && <NotificationCenter onNav={s => setSection(s as TeacherSection)} />}
          {section === 'babillard' && <Babillard role={user?.role ?? 'TEACHER'} title={tnav('sidebar.babillard')} subtitle={tcommon('brand.roleTeacher')} currentUserId={user?.id} />}
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
      <TeacherBottomNav current={section} onChange={setSection} onOpenMenu={() => setMobileNavOpen(true)} pendingGrades={pendingGrades} />
    </div>
  )
}
