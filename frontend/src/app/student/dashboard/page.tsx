'use client'

import { useState, useCallback, useEffect } from 'react'
import { logoutUser } from '@/lib/userAuth'
import StudentSidebar from './_components/StudentSidebar'
import StudentTopbar from './_components/StudentTopbar'
import StudentBottomNav from './_components/StudentBottomNav'
import StudentToast from './_components/StudentToast'
import NotificationCenter from '@/components/NotificationCenter'
import SectionStudentDashboard from './_components/SectionStudentDashboard'
import SectionStudentGrades from './_components/SectionStudentGrades'
import SectionStudentBulletins from './_components/SectionStudentBulletins'
import SectionStudentTimetable from './_components/SectionStudentTimetable'
import SectionStudentAttendance from './_components/SectionStudentAttendance'
import SectionStudentLibrary from './_components/SectionStudentLibrary'
import SectionStudentHealthTracking from './_components/SectionStudentHealthTracking'
import SectionProfilAcademique from '@/features/student/SectionProfilAcademique'
import HealthAlertBanner from './_components/HealthAlertBanner'
import type { StudentSection, Toast, UserInfo } from './_types'
import { fetchApi } from '@/lib/fetchApi'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { putCachedData } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import EventCenterWidget from '@/features/communication/EventCenterWidget'
import AssistantWidget from '../../admin/dashboard/_components/AssistantWidget'
import { useRouter } from 'next/navigation'
import Babillard from '@/features/communication/Babillard'
import Messagerie from '@/features/messagerie'
import ChangePasswordModal from '@/components/ChangePasswordModal'

interface SessionUser {
  userId: string
  role: string
  nomComplet?: string
  firstName?: string
  permissions?: string[]
}

const STUDENT_SECTIONS: StudentSection[] = ['dashboard', 'grades', 'bulletins', 'timetable', 'attendance', 'library', 'health-tracking', 'notifications', 'babillard', 'messagerie', 'academic-profile']
const STUDENT_ASSISTANT_SUGGESTIONS = [
  'Quelles sont mes dernières notes ?',
  'Quel est mon taux de présence ce mois-ci ?',
  'Quels livres ai-je empruntés ?',
]

let toastId = 0

export default function StudentDashboard() {
  const tnav = useT('navigation')
  const router = useRouter()
  const TITLES: Record<StudentSection, string> = {
    dashboard:  tnav('pageTitle.student_dashboard'),
    grades:     tnav('pageTitle.student_grades'),
    bulletins:  tnav('pageTitle.student_bulletins'),
    timetable:  tnav('pageTitle.student_timetable'),
    attendance: tnav('pageTitle.student_attendance'),
    library:    tnav('pageTitle.student_library'),
    'health-tracking': tnav('pageTitle.student_healthTracking'),
    notifications: tnav('pageTitle.student_notifications'),
    babillard:  tnav('sidebar.babillard'),
    messagerie: tnav('sidebar.messagerie'),
    'academic-profile': tnav('pageTitle.student_academicProfile'),
  }
  const [section, setSection] = useState<StudentSection>('dashboard')
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logoUrl: string | null } | null>(null)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [changePwdOpen, setChangePwdOpen] = useState(false)

  // Lecture session depuis localStorage (stockée au login) — identique à admin/staff/teacher/parent
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
      } else if (targetSection && STUDENT_SECTIONS.includes(targetSection as StudentSection)) {
        setSection(targetSection as StudentSection)
      }
    } catch { /* silencieux — données absentes ou corrompues */ }
  }, [])

  // Infos école + utilisateur — fetch en arrière-plan
  useEffect(() => {
    fetchApi('/api/v2/school/me', { credentials: 'include' })
      .then(r => r.json())
      .then(d => { if (d.success) setSchoolInfo(d.data) })
      .catch(() => {})
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
      .catch(err => { if (err !== 'auth') console.warn('[student-dashboard] Erreur réseau:', err) })
  }, [router])

  useEffect(() => {
    if (!user || !navigator.onLine) return
    const uid = user.id
    ;(async () => {
      try {
        const now = Date.now()
        const rcRes = await fetchApi('/api/v2/report-cards/my', { credentials: 'include' }).then(r => r.json())
        if (rcRes.reportCards) await putCachedData(`student:bulletins:${uid}`, rcRes.reportCards)
        const [statsRes, recordsRes] = await Promise.all([
          fetchApi('/api/v2/attendance/stats', { credentials: 'include' }).then(r => r.json()),
          fetchApi('/api/v2/attendance?limit=100', { credentials: 'include' }).then(r => r.json()),
        ])
        const stats = statsRes.stats ? {
          total: statsRes.stats.total || 0, present: statsRes.stats.present || 0,
          absent: statsRes.stats.absent || 0, late: statsRes.stats.late || 0,
          excused: statsRes.stats.excused || 0, attendanceRate: statsRes.stats.attendanceRate || '0%',
        } : null
        const weeks: Record<string, { week: string; present: number; absent: number; late: number; excused: number }> = {}
        ;(recordsRes.records || []).forEach((r: any) => {
          const d = new Date(r.date), sw = new Date(d)
          sw.setDate(d.getDate() - d.getDay() + 1)
          const k = sw.toISOString().slice(0, 10)
          if (!weeks[k]) weeks[k] = { week: k, present: 0, absent: 0, late: 0, excused: 0 }
          if (r.status === 'PRESENT') weeks[k].present++
          else if (r.status === 'ABSENT') weeks[k].absent++
          else if (r.status === 'LATE') weeks[k].late++
          else if (r.status === 'EXCUSED') weeks[k].excused++
        })
        const fmt = (s: string) => { const d = new Date(s + 'T00:00:00'), e = new Date(d); e.setDate(d.getDate() + 4); return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}` }
        const weekly = Object.values(weeks).sort((a, b) => a.week.localeCompare(b.week)).map(w => ({ ...w, week: fmt(w.week) }))
        await putCachedData(`student:attendance:${uid}`, { stats, weekly })
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

  const sProps = { onToast: showToast, user }

  // Navigation temps réel déclenchée par l'assistant IA (copilot) : quand il répond à
  // une question, on bascule vers l'écran concerné pour que l'information soit visible.
  useEffect(() => {
    const onNavigate = (e: Event) => {
      const navSection = (e as CustomEvent<{ section?: string }>).detail?.section
      if (navSection && STUDENT_SECTIONS.includes(navSection as StudentSection)) setSection(navSection as StudentSection)
    }
    window.addEventListener('zekoulabia:navigate', onNavigate)
    return () => window.removeEventListener('zekoulabia:navigate', onNavigate)
  }, [])

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>
      <StudentSidebar current={section} onChange={setSection} schoolName={schoolInfo?.name} logoUrl={schoolInfo?.logoUrl} onLogout={logoutUser} user={user} mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <StudentTopbar
          title={TITLES[section]}
          onMenuClick={() => setMobileNavOpen(true)}
          onChangePassword={() => setChangePwdOpen(true)}
          onNavigate={s => setSection(s as StudentSection)}
          user={user}
          onLogout={logoutUser}
          onToast={showToast}
        />
        <EventCenterWidget />
        <HealthAlertBanner onNav={s => setSection(s as StudentSection)} />

        <main className="pb-[calc(60px+env(safe-area-inset-bottom,0px))] md:pb-0" style={{ flex: 1, overflow: 'hidden', background: 'var(--bg)' }}>
          {section === 'dashboard'  && <SectionStudentDashboard onNav={s => setSection(s as StudentSection)} {...sProps} />}
          {section === 'grades'     && <SectionStudentGrades {...sProps} />}
          {section === 'bulletins'  && <SectionStudentBulletins {...sProps} />}
          {section === 'timetable'  && <SectionStudentTimetable {...sProps} />}
          {section === 'attendance' && <SectionStudentAttendance {...sProps} />}
          {section === 'library'    && <SectionStudentLibrary />}
          {section === 'health-tracking' && <SectionStudentHealthTracking user={user} />}
          {section === 'notifications' && <NotificationCenter onNav={(s: string) => setSection(s as StudentSection)} />}
          {section === 'babillard' && <Babillard role={user?.role ?? 'STUDENT'} title={tnav('sidebar.babillard')} subtitle={tnav('group.communication')} currentUserId={user?.id} />}
          {section === 'messagerie' && <Messagerie />}
          {section === 'academic-profile' && <SectionProfilAcademique studentId={user?.id ?? ''} />}
        </main>
      </div>

      {changePwdOpen && <ChangePasswordModal onClose={() => setChangePwdOpen(false)} onToast={showToast} />}
      <StudentToast toasts={toasts} onRemove={removeToast} />
      <OfflineIndicator />
      <AssistantWidget section={section} rolePrefix="student" suggestions={STUDENT_ASSISTANT_SUGGESTIONS} />
      <StudentBottomNav current={section} onChange={setSection} onOpenMenu={() => setMobileNavOpen(true)} />
    </div>
  )
}
