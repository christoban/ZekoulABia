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
import SectionStudentHomework from './_components/SectionStudentHomework'
import SectionStudentOrientation from './_components/SectionStudentOrientation'
import SectionStudentDocuments from './_components/SectionStudentDocuments'
import SectionProfilAcademique from '@/features/student/SectionProfilAcademique'
import SectionStudentProfile from './_components/SectionStudentProfile'
import HealthAlertBanner from './_components/HealthAlertBanner'
import type { StudentSection, Toast, UserInfo } from './_types'
import { fetchApi } from '@/lib/fetchApi'
import { OfflineIndicator } from '@/components/OfflineIndicator'
import { putCachedData, getUserSession, putUserSession } from '@/lib/offline/db'
import { useT } from '@/lib/i18n'
import EventCenterWidget from '@/features/communication/EventCenterWidget'
import AssistantWidget from '../../admin/dashboard/_components/AssistantWidget'
import { useRouter } from 'next/navigation'
import Babillard from '@/features/communication/Babillard'
import Messagerie from '@/features/messagerie'
import ChangePasswordModal from '@/components/ChangePasswordModal'
import { formatStudentTimetableData } from '@/lib/timetableSlotGrouping'
import { resolveOrientationEligibility } from '@/lib/orientationEligibility'

interface SessionUser {
  userId: string
  role: string
  nomComplet?: string
  firstName?: string
  permissions?: string[]
}

const STUDENT_SECTIONS: StudentSection[] = [
  'dashboard',
  'grades',
  'bulletins',
  'timetable',
  'attendance',
  'library',
  'health-tracking',
  'notifications',
  'babillard',
  'messagerie',
  'academic-profile',
  'homework',
  'orientation',
  'documents',
  'profile',
]
const STUDENT_ASSISTANT_SUGGESTIONS = [
  'Quelles sont mes dernières notes ?',
  'Quel est mon taux de présence ce mois-ci ?',
  'Quels devoirs ai-je pour demain ?',
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
    homework:   tnav('sidebar.homework') || 'Cahier de Texte & Devoirs',
    orientation: tnav('sidebar.orientation') || 'Mon Orientation',
    documents:  tnav('sidebar.documents') || 'Mes Documents',
    profile:    'Mon Dossier & Profil Scolaire',
  }
  const [section, setSection] = useState<StudentSection>('dashboard')
  const [visitedSections, setVisitedSections] = useState<Set<StudentSection>>(() => new Set(['dashboard']))

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
  const [changePwdOpen, setChangePwdOpen] = useState(false)

  // Lecture session depuis localStorage (stockée au login) + restauration Dexie offline
  useEffect(() => {
    try {
      const raw = localStorage.getItem('zekoulabia_user')
      if (raw) {
        const sessionUser = JSON.parse(raw) as SessionUser
        setUser({ id: sessionUser.userId, firstName: sessionUser.firstName ?? '', lastName: sessionUser.nomComplet?.split(' ').slice(1).join(' ') ?? '', email: '', role: sessionUser.role })
        getUserSession(sessionUser.userId).then(saved => {
          if (saved) {
            if (saved.schoolInfo) setSchoolInfo({ name: saved.schoolInfo.name, logoUrl: saved.schoolInfo.logoUrl })
            if (saved.fullProfile) setUser(saved.fullProfile as unknown as UserInfo)
          }
        }).catch(() => {})
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
      .then(d => {
        if (d.success) {
          setSchoolInfo(d.data)
          try {
            const raw = localStorage.getItem('zekoulabia_user')
            if (raw) {
              const u = JSON.parse(raw)
              putUserSession({ userId: u.userId, role: u.role, schoolInfo: d.data }).catch(() => {})
            }
          } catch { /* ignore */ }
        }
      })
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
      .then(d => {
        if (d.success) {
          setUser(d.data)
          try {
            const raw = localStorage.getItem('zekoulabia_user')
            if (raw) {
              const u = JSON.parse(raw)
              putUserSession({ userId: u.userId, role: u.role, fullProfile: d.data }).catch(() => {})
            }
          } catch { /* ignore */ }
        }
      })
      .catch(err => { if (err !== 'auth') console.warn('[student-dashboard] Erreur réseau:', err) })
  }, [router])

  useEffect(() => {
    if (!user || !navigator.onLine) return
    const uid = user.id
    const classId = user.studentProfile?.class?.id
    const className = user.studentProfile?.class?.name || ''
    const groupIds = user.studentProfile?.groupIds ?? []
    const groupKey = [...groupIds].sort().join(',')

    ;(async () => {
      try {
        // 1. Bulletins scolaires
        const rcRes = await fetchApi('/api/v2/report-cards/my', { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
        if (rcRes.reportCards) await putCachedData(`student:bulletins:${uid}`, rcRes.reportCards)

        // 2. Assiduité et statistiques
        const [statsRes, recordsRes] = await Promise.all([
          fetchApi('/api/v2/attendance/stats', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
          fetchApi('/api/v2/attendance?limit=100', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
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

        // 3. Année académique & Séquences (indispensable pour l'affichage offline des notes)
        const ayRes = await fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
        if (ayRes.success && ayRes.data) {
          await putCachedData('student:academic-years', ayRes.data)

          // Extraire toutes les séquences de l'année courante
          const curYear = ayRes.data.find((y: any) => y.isCurrent) ?? ayRes.data[0]
          const seqIds: string[] = []
          for (const period of (curYear?.periods ?? [])) {
            for (const s of (period.sequences ?? [])) {
              if (s.id) seqIds.push(s.id)
            }
          }

          // 4. Préchargement des notes pour chaque séquence
          if (classId) {
            for (const seqId of seqIds) {
              try {
                const [gradesRes, avgRes] = await Promise.all([
                  fetchApi(`/api/v2/grades?sequenceId=${seqId}`, { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
                  fetchApi(`/api/v2/grades/average/${uid}?classId=${classId}&sequenceId=${seqId}`, { credentials: 'include' }).then(r => r.json()).catch(() => null),
                ])
                if (gradesRes.grades || avgRes) {
                  await putCachedData(`student:grades:${uid}:${seqId}`, {
                    grades: gradesRes.grades ?? [],
                    avg: avgRes?.average ?? null,
                    rank: avgRes?.rank != null ? { pos: avgRes.rank, total: avgRes.totalStudents || 0 } : null,
                  })
                }
              } catch { /* ignore */ }
            }
          }
        }

        // 5. Emploi du temps & configuration de la grille
        if (classId) {
          const [ttRes, gridRes] = await Promise.all([
            fetchApi(`/api/v2/timetables?classId=${classId}`, { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
            fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()).catch(() => ({})),
          ])
          if (gridRes.success && gridRes.data) {
            await putCachedData('student:timetable-grid-config', gridRes.data)
          }
          if (ttRes.success && ttRes.data) {
            await putCachedData(`student:timetables:${classId}`, ttRes.data)
            const lv2Subject = user.studentProfile?.lv2Subject
            const formatted = formatStudentTimetableData(
              ttRes.data,
              gridRes?.data,
              groupIds,
              className,
              undefined,
              {
                studentLv2SubjectId: lv2Subject?.id,
                studentLv2SubjectName: lv2Subject?.name,
              }
            )
            const v3Key = `student:timetable:v3:${classId}:${[...groupIds].sort().join(',')}:${lv2Subject?.id || ''}`
            await putCachedData(v3Key, formatted)
            await putCachedData(`student:timetable:v2:${classId}:${groupKey}`, formatted)
          }

          // 6. Cahier de texte & devoirs
          const cahierRes = await fetchApi(`/api/v2/pedagogie/cahier-de-texte?classId=${classId}&limit=100`, { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
          if (cahierRes.success && Array.isArray(cahierRes.data)) {
            await putCachedData(`student:cahier:${uid}:${classId}`, cahierRes.data)
          }
        }

        // 7. Profil académique de l'élève
        const profileRes = await fetchApi(`/api/v2/students/${uid}/academic-profile`, { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
        if (profileRes.success && profileRes.data) {
          await putCachedData(`student:academic-profile:${uid}`, profileRes.data)
        }

        // 8. Mes lectures / Bibliothèque (même liste vide pour éviter OFFLINE_NO_CACHE)
        const loansRes = await fetchApi('/api/v2/library/my-loans', { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
        if (loansRes.success && Array.isArray(loansRes.data)) {
          await putCachedData('student-library', loansRes.data)
        } else {
          await putCachedData('student-library', [])
        }

        // 9. Messagerie : conversations et messages récents
        const convRes = await fetchApi('/api/v2/messagerie/conversations', { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
        if (convRes.success && Array.isArray(convRes.data)) {
          await putCachedData(`messagerie:conversations:${uid}`, convRes.data)
          await putCachedData('messagerie:conversations', convRes.data)

          // Précharger les messages des conversations (top 5) pour consultation hors-ligne immédiate
          for (const c of convRes.data.slice(0, 5)) {
            if (c?.id) {
              try {
                const msgRes = await fetchApi(`/api/v2/messagerie/conversations/${c.id}/messages`, { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
                if (msgRes.success && Array.isArray(msgRes.data)) {
                  await putCachedData(`messagerie:messages:${c.id}`, msgRes.data)
                }
              } catch { /* silencieux */ }
            }
          }
        }

        // 10. Suivi scolaire & santé (IA Health Tracking)
        const htRes = await fetchApi('/api/v2/ai/health-tracking', { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
        if (htRes.children && Array.isArray(htRes.children) && htRes.children[0]) {
          await putCachedData(`student:health-tracking:${uid}`, htRes.children[0])
        }

        // 11. Orientation & Langue Vivante 2
        if (user.studentProfile?.class) {
          try {
            const eligibility = resolveOrientationEligibility(
              user.studentProfile.class.name,
              user.studentProfile.class.level,
              user.studentProfile.class.serie
            )
            if (eligibility.checkpointKey === 'FIN_TROISIEME' || eligibility.checkpointKey === 'FIN_SECONDE_C') {
              const recoRes = await fetchApi(`/api/v2/orientation/ma-recommandation/${eligibility.checkpointKey}`, { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
              if (recoRes.success && recoRes.data) {
                await putCachedData(`student:orientation:${uid}:${eligibility.checkpointKey}`, recoRes.data)
              }
            } else if (eligibility.checkpointKey === 'LV2') {
              const lv2Res = await fetchApi('/api/v2/students/me/lv2-choice-window', { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
              if (lv2Res.success && lv2Res.data) {
                await putCachedData(`student:lv2-choice:${uid}`, lv2Res.data)
              }
            }
          } catch { /* silencieux */ }
        }

        // 12. Babillard officiel
        const babRes = await fetchApi('/api/v2/babillard?tab=tous', { credentials: 'include' }).then(r => r.json()).catch(() => ({}))
        const babItems = babRes.data || babRes.publications || []
        if (Array.isArray(babItems)) {
          await putCachedData('babillard:publications:all', babItems)
          const counts = babRes.counts ? {
            all: babRes.counts.tous ?? babItems.length,
            pinned: babRes.counts.une ?? 0,
            for_me: babRes.counts.pourMoi ?? 0,
            unread: babRes.counts.nonLus ?? 0,
            archives: babRes.counts.archives ?? 0,
          } : {
            all: babItems.length,
            pinned: babItems.filter((p: any) => p.isPinned || p.pinned).length,
            for_me: babItems.length,
            unread: 0,
            archives: 0,
          }
          await putCachedData('babillard:counts', counts)
        }
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
          <div style={{ display: section === 'dashboard' ? 'contents' : 'none' }}>
            <SectionStudentDashboard onNav={s => setSection(s as StudentSection)} {...sProps} />
          </div>
          {visitedSections.has('grades') && (
            <div style={{ display: section === 'grades' ? 'contents' : 'none' }}>
              <SectionStudentGrades {...sProps} />
            </div>
          )}
          {visitedSections.has('bulletins') && (
            <div style={{ display: section === 'bulletins' ? 'contents' : 'none' }}>
              <SectionStudentBulletins {...sProps} />
            </div>
          )}
          {visitedSections.has('timetable') && (
            <div style={{ display: section === 'timetable' ? 'contents' : 'none' }}>
              <SectionStudentTimetable {...sProps} />
            </div>
          )}
          {visitedSections.has('attendance') && (
            <div style={{ display: section === 'attendance' ? 'contents' : 'none' }}>
              <SectionStudentAttendance {...sProps} />
            </div>
          )}
          {visitedSections.has('library') && (
            <div style={{ display: section === 'library' ? 'contents' : 'none' }}>
              <SectionStudentLibrary />
            </div>
          )}
          {visitedSections.has('health-tracking') && (
            <div style={{ display: section === 'health-tracking' ? 'contents' : 'none' }}>
              <SectionStudentHealthTracking user={user} />
            </div>
          )}
          {visitedSections.has('notifications') && (
            <div style={{ display: section === 'notifications' ? 'contents' : 'none' }}>
              <NotificationCenter onNav={(s: string) => setSection(s as StudentSection)} />
            </div>
          )}
          {visitedSections.has('babillard') && (
            <div style={{ display: section === 'babillard' ? 'contents' : 'none' }}>
              <Babillard role={user?.role ?? 'STUDENT'} title={tnav('sidebar.babillard')} subtitle={tnav('group.communication')} currentUserId={user?.id} />
            </div>
          )}
          {visitedSections.has('messagerie') && (
            <div style={{ display: section === 'messagerie' ? 'contents' : 'none' }}>
              <Messagerie />
            </div>
          )}
          {visitedSections.has('academic-profile') && (
            <div style={{ display: section === 'academic-profile' ? 'contents' : 'none' }}>
              <SectionProfilAcademique studentId={user?.id ?? ''} />
            </div>
          )}
          {visitedSections.has('homework') && (
            <div style={{ display: section === 'homework' ? 'contents' : 'none' }}>
              <SectionStudentHomework user={user} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('orientation') && (
            <div style={{ display: section === 'orientation' ? 'contents' : 'none' }}>
              <SectionStudentOrientation user={user} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('documents') && (
            <div style={{ display: section === 'documents' ? 'contents' : 'none' }}>
              <SectionStudentDocuments user={user} onToast={showToast} onNav={s => setSection(s as StudentSection)} />
            </div>
          )}
          {visitedSections.has('profile') && (
            <div style={{ display: section === 'profile' ? 'contents' : 'none' }}>
              <SectionStudentProfile onToast={showToast} />
            </div>
          )}
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
