import { fetchApi } from '@/lib/fetchApi'
import { putCachedData } from '@/lib/offline/db'
import type { UserInfo } from '../_types'

interface AySeqItem {
  id: string
  name: string
  isCurrent?: boolean
  [key: string]: unknown
}
interface AyPeriodItem {
  id: string
  name: string
  sequences?: AySeqItem[]
}
interface AyYearItem {
  id: string
  isCurrent?: boolean
  periods?: AyPeriodItem[]
}
interface CachedSeqItem extends AySeqItem {
  periodName: string
  academicYearId: string
}

interface RawClassStudent {
  id: string
  firstName?: string
  lastName?: string
  matricule?: string
  rang?: number
  moyenne?: number
  tauxPresence?: number
}

interface RawPpReportCard {
  id: string
  studentId: string
  student?: { firstName?: string | null; lastName?: string | null } | null
  generalAverage?: number | null
  classMasterComment?: string | null
  status?: string | null
}

/** Préchargement exhaustif en tâche de fond pour l'autonomie hors-ligne complète (enseignant simple, PP et AP) */
export async function prefetchTeacherOfflineData(user: UserInfo): Promise<void> {
  const uid = user.id
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
    let seqs: CachedSeqItem[] = []
    if (ayRes?.success && Array.isArray(ayRes.data)) {
      const ayYears = ayRes.data as AyYearItem[]
      seqs = ayYears.flatMap((ay) =>
        ay.periods?.flatMap((p) =>
          p.sequences?.map((s) => ({ ...s, periodName: p.name, academicYearId: ay.id })) || []
        ) || []
      )
      await putCachedData('teacher:sequences', seqs)

      const currentYear = ayYears.find((y) => y.isCurrent) ?? ayYears[0]
      if (currentYear?.periods?.length) {
        await putCachedData('teacher:academic-periods', currentYear.periods)
      }
    }

    const classes = clsRes?.success && Array.isArray(clsRes.data) ? clsRes.data : []

    // 2. Pour chaque classe : élèves, assignations, cahier de texte
    for (const cls of classes) {
      if (!cls.id) continue

      const studRes = await fetchApi(`/api/v2/classes/${cls.id}/students`, { credentials: 'include' }).then(r => r.json()).catch(() => null)
      if (studRes?.success && Array.isArray(studRes.data)) {
        const mappedStudents = (studRes.data as RawClassStudent[]).map((s) => ({
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

      const assignRes = await fetchApi(`/api/v2/teaching-assignments?classId=${cls.id}`, { credentials: 'include' }).then(r => r.json()).catch(() => null)
      if (assignRes?.success && Array.isArray(assignRes.data)) {
        await putCachedData(`teacher:teaching-assignments:${cls.id}`, assignRes.data)
      }

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
          const cards = (rcRes.reportCards as RawPpReportCard[]).map((rc) => ({
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

    // Messagerie : conversations et messages récents de l'enseignant
    try {
      const convRes = await fetchApi('/api/v2/messagerie/conversations', { credentials: 'include' }).then(r => r.json()).catch(() => null)
      if (convRes?.success && Array.isArray(convRes.data)) {
        await putCachedData(`messagerie:conversations:${uid}`, convRes.data).catch(() => {})
        await putCachedData('messagerie:conversations', convRes.data).catch(() => {})
        for (const c of convRes.data.slice(0, 5)) {
          if (c?.id) {
            const msgRes = await fetchApi(`/api/v2/messagerie/conversations/${c.id}/messages`, { credentials: 'include' }).then(r => r.json()).catch(() => null)
            if (msgRes?.success && Array.isArray(msgRes.data)) {
              await putCachedData(`messagerie:messages:${c.id}`, msgRes.data).catch(() => {})
            }
          }
        }
      }
    } catch { /* ignore */ }

    // Babillard officiel & compteurs
    try {
      const babRes = await fetchApi('/api/v2/babillard?tab=tous', { credentials: 'include' }).then(r => r.json()).catch(() => null)
      const babItems = babRes?.data || babRes?.publications || []
      if (Array.isArray(babItems)) {
        await putCachedData('babillard:publications:all', babItems).catch(() => {})
        if (babRes?.counts) {
          const countsObj = {
            all: babRes.counts.tous ?? 0,
            pinned: babRes.counts.une ?? 0,
            for_me: babRes.counts.pourMoi ?? 0,
            unread: babRes.counts.nonLus ?? 0,
            archives: babRes.counts.archives ?? 0,
          }
          await putCachedData('babillard:counts', countsObj).catch(() => {})
        }
      }
    } catch { /* ignore */ }
  } catch { /* silencieux */ }
}
