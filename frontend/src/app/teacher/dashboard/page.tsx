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
import { getUserSession, putUserSession, putCachedData } from '@/lib/offline/db'
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
  'dashboard', 'classes', 'attendance', 'grades', 'bulletins', 'timetable', 'sync',
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

    // Restauration immédiate du profil complet (PP, AP, schoolInfo) depuis Dexie userSession
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
      }).catch(() => { })

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
          // Persistance du profil complet (avec classesProfessorPrincipal et headedDepartments) dans Dexie
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
      .then(r => r.json()).then(d => { if (d.pagination) setPendingGrades(d.pagination.total ?? 0) }).catch(() => { })
  }, [router])

  // Préchargement exhaustif en tâche de fond pour l'autonomie hors-ligne complète (enseignant simple, PP et AP)
  useEffect(() => {
    if (!user || !navigator.onLine) return
    const uid = user.id
    ;(async () => {
      try {
        // 1. Classes, matières, grille horaire, emplois du temps et années académiques
        const [clsRes, subRes, ayRes, gridRes, ttRes] = await Promise.all([
          fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()).catch(() => null),
          fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()).catch(() => null),
          fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()).catch(() => null),
          fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()).catch(() => null),
          fetchApi('/api/v2/timetables', { credentials: 'include' }).then(r => r.json()).catch(() => null),
        ])

        if (clsRes?.success && Array.isArray(clsRes.data)) {
          await putCachedData('teacher:classes', clsRes.data)
        }
        if (subRes?.success && Array.isArray(subRes.data)) {
          await putCachedData('teacher:subjects', subRes.data)
        }
        if (gridRes?.success && gridRes.data) {
          await putCachedData('teacher:timetable-grid-config', gridRes.data)
        }
        if (ttRes?.success && Array.isArray(ttRes.data)) {
          await putCachedData(`teacher:timetables:${uid}`, ttRes.data)
          await putCachedData('teacher:timetables:all', ttRes.data)
        }

        // Périodes et séquences
        let seqs: any[] = []
        if (ayRes?.success && Array.isArray(ayRes.data)) {
          seqs = ayRes.data.flatMap((ay: any) =>
            ay.periods?.flatMap((p: any) =>
              p.sequences?.map((s: any) => ({ ...s, periodName: p.name, academicYearId: ay.id })) || []
            ) || []
          )
          await putCachedData('teacher:sequences', seqs)

          const currentYear = ayRes.data.find((y: any) => y.isCurrent) ?? ayRes.data[0]
          if (currentYear?.periods?.length) {
            await putCachedData('teacher:academic-periods', currentYear.periods)
          }
        }

        const classes = clsRes?.success && Array.isArray(clsRes.data) ? clsRes.data : []

        // 2. Pour chaque classe : élèves, assignations, cahier de texte
        for (const cls of classes) {
          if (!cls.id) continue

          // Élèves de la classe (utilisé par SectionTeacherAttendance et SectionProfesseurPrincipal)
          const studRes = await fetchApi(`/api/v2/classes/${cls.id}/students`, { credentials: 'include' }).then(r => r.json()).catch(() => null)
          if (studRes?.success && Array.isArray(studRes.data)) {
            const mappedStudents = studRes.data.map((s: any) => ({
              id: s.id,
              name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || 'Élève inconnu',
              firstName: s.firstName,
              lastName: s.lastName,
              matricule: s.matricule,
              rang: s.rang,
              moyenne: s.moyenne,
              tauxPresence: s.tauxPresence,
            }))
            await putCachedData(`teacher:students:${cls.id}`, mappedStudents)
            await putCachedData(`teacher:pp-students:${cls.id}`, studRes.data)
          }

          // Affectations d'enseignement
          const assignRes = await fetchApi(`/api/v2/teaching-assignments?classId=${cls.id}`, { credentials: 'include' }).then(r => r.json()).catch(() => null)
          if (assignRes?.success && Array.isArray(assignRes.data)) {
            await putCachedData(`teacher:teaching-assignments:${cls.id}`, assignRes.data)
          }

          // Cahier de texte de la classe
          const cahierRes = await fetchApi(`/api/v2/pedagogie/cahier-de-texte?classId=${cls.id}&limit=50`, { credentials: 'include' }).then(r => r.json()).catch(() => null)
          if (cahierRes?.success && Array.isArray(cahierRes.data)) {
            await putCachedData(`teacher:cahierDeTexte:${cls.id}`, cahierRes.data)
          }
        }

        // Cahier de texte global
        const cahierAll = await fetchApi('/api/v2/pedagogie/cahier-de-texte?limit=50', { credentials: 'include' }).then(r => r.json()).catch(() => null)
        if (cahierAll?.success && Array.isArray(cahierAll.data)) {
          await putCachedData('teacher:cahierDeTexte:all', cahierAll.data)
        }

        // Élèves à risque
        const atRiskRes = await fetchApi('/api/v2/ai/at-risk-students', { credentials: 'include' }).then(r => r.json()).catch(() => null)
        if (atRiskRes) {
          await putCachedData('teacher:at-risk-students', atRiskRes)
        }

        // Actions de suivi
        const followUpRes = await fetchApi('/api/v2/student-follow-up/mine', { credentials: 'include' }).then(r => r.json()).catch(() => null)
        if (followUpRes?.success && Array.isArray(followUpRes.data)) {
          await putCachedData('teacher:mes-actions-suivi', followUpRes.data)
        }

        // 3. Spécifique Professeur Principal (PP)
        const ppClasses = user.classesProfessorPrincipal ?? []
        for (const ppCls of ppClasses) {
          if (!ppCls.id) continue
          const currentPeriods = ayRes?.data?.[0]?.periods ?? []
          for (const per of currentPeriods) {
            const rcRes = await fetchApi(`/api/v2/report-cards?classId=${ppCls.id}&periodId=${per.id}&limit=100`, { credentials: 'include' }).then(r => r.json()).catch(() => null)
            if (rcRes?.reportCards) {
              const cards = rcRes.reportCards.map((rc: any) => ({
                id: rc.id,
                studentId: rc.studentId,
                studentName: rc.student ? `${rc.student.lastName ?? ''} ${rc.student.firstName ?? ''}`.trim() : rc.studentId,
                generalAverage: rc.generalAverage ?? null,
                classMasterComment: rc.classMasterComment ?? null,
                status: rc.status ?? '',
              }))
              await putCachedData(`teacher:pp-report-cards:${ppCls.id}:${per.id}`, cards)
            }
          }
        }

        // 4. Spécifique Animateur Pédagogique (AP)
        const apDepts = user.headedDepartments ?? []
        for (const dept of apDepts) {
          if (!dept.id) continue
          const [perfRes, progAlertRes] = await Promise.all([
            fetchApi(`/api/v2/departments/${dept.id}/performance`, { credentials: 'include' }).then(r => r.json()).catch(() => null),
            fetchApi('/api/v2/pedagogie/alertes-retard', { credentials: 'include' }).then(r => r.json()).catch(() => null),
          ])
          if (perfRes?.data) {
            await putCachedData(`teacher:dept-perf:${dept.id}`, perfRes.data)
          }
          if (progAlertRes?.data) {
            await putCachedData(`teacher:dept-progression:${dept.id}`, progAlertRes.data)
          }
        }
      } catch { /* silencieux */ }
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
          <div style={{ display: section === 'dashboard' ? 'contents' : 'none' }}>
            <SectionTeacherDashboard onNav={s => setSection(s as TeacherSection)} {...sProps} />
          </div>
          {visitedSections.has('classes') && (
            <div style={{ display: section === 'classes' ? 'contents' : 'none' }}>
              <SectionTeacherClasses onNav={s => setSection(s as TeacherSection)} {...sProps} />
            </div>
          )}
          {visitedSections.has('attendance') && (
            <div style={{ display: section === 'attendance' ? 'contents' : 'none' }}>
              <SectionTeacherAttendance {...sProps} />
            </div>
          )}
          {visitedSections.has('grades') && (
            <div style={{ display: section === 'grades' ? 'contents' : 'none' }}>
              <SectionTeacherGrades {...sProps} />
            </div>
          )}
          {visitedSections.has('timetable') && (
            <div style={{ display: section === 'timetable' ? 'contents' : 'none' }}>
              <SectionTeacherTimetable {...sProps} />
            </div>
          )}
          {visitedSections.has('sync') && (
            <div style={{ display: section === 'sync' ? 'contents' : 'none' }}>
              <SectionOfflineStatus onToast={showToast} namespace="teacher" />
            </div>
          )}
          {visitedSections.has('pp-classe') && (
            <div style={{ display: section === 'pp-classe' ? 'contents' : 'none' }}>
              {(() => {
                const ppList = user?.classesProfessorPrincipal ?? []
                const activeCls = ppList.find(c => c.id === selectedPPClassId) || ppList[0]
                return activeCls ? (
                  <SectionProfesseurPrincipal
                    user={user!}
                    classeId={activeCls.id}
                    classeNom={activeCls.name}
                    classesList={ppList}
                    onSelectClasse={setSelectedPPClassId}
                  />
                ) : null
              })()}
            </div>
          )}
          {visitedSections.has('pp-appreciations') && (
            <div style={{ display: section === 'pp-appreciations' ? 'contents' : 'none' }}>
              {(() => {
                const ppList = user?.classesProfessorPrincipal ?? []
                const activeCls = ppList.find(c => c.id === selectedPPClassId) || ppList[0]
                return activeCls ? (
                  <SectionAppreciationsPP
                    user={user!}
                    classeId={activeCls.id}
                    classeNom={activeCls.name}
                    classesList={ppList}
                    onSelectClasse={setSelectedPPClassId}
                  />
                ) : null
              })()}
            </div>
          )}
          {visitedSections.has('ap-departement') && (
            <div style={{ display: section === 'ap-departement' ? 'contents' : 'none' }}>
              {(() => {
                const deptList = user?.headedDepartments ?? []
                const activeDept = deptList.find(d => d.id === selectedAPDeptId) || deptList[0]
                return activeDept ? (
                  <SectionDepartementAP
                    user={user!}
                    departementId={activeDept.id}
                    departementNom={activeDept.name}
                    departmentsList={deptList}
                    onSelectDept={setSelectedAPDeptId}
                    onToast={showToast}
                  />
                ) : null
              })()}
            </div>
          )}
          {visitedSections.has('cahier-de-texte') && (
            <div style={{ display: section === 'cahier-de-texte' ? 'contents' : 'none' }}>
              <SectionCahierDeTexte user={user} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('at-risk') && user && (
            <div style={{ display: section === 'at-risk' ? 'contents' : 'none' }}>
              <SectionTeacherAtRisk currentUserId={user.id} onToast={showToast} />
            </div>
          )}
          {visitedSections.has('mon-suivi') && (
            <div style={{ display: section === 'mon-suivi' ? 'contents' : 'none' }}>
              <SectionMesActionsSuivi onToast={showToast} />
            </div>
          )}
          {visitedSections.has('correction-anonyme') && (
            <div style={{ display: section === 'correction-anonyme' ? 'contents' : 'none' }}>
              <SectionTeacherCorrectionAnonyme onToast={showToast} />
            </div>
          )}
          {visitedSections.has('mon-profil-rh') && (
            <div style={{ display: section === 'mon-profil-rh' ? 'contents' : 'none' }}>
              <SectionMonProfilRH onToast={showToast} />
            </div>
          )}
          {visitedSections.has('notifications') && (
            <div style={{ display: section === 'notifications' ? 'contents' : 'none' }}>
              <NotificationCenter onNav={s => setSection(s as TeacherSection)} />
            </div>
          )}
          {visitedSections.has('babillard') && (
            <div style={{ display: section === 'babillard' ? 'contents' : 'none' }}>
              <Babillard role={user?.role ?? 'TEACHER'} title={tnav('sidebar.babillard')} subtitle={tcommon('brand.roleTeacher')} currentUserId={user?.id} />
            </div>
          )}
          {visitedSections.has('messagerie') && (
            <div style={{ display: section === 'messagerie' ? 'contents' : 'none' }}>
              <Messagerie />
            </div>
          )}
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
