import { fetchApi } from '@/lib/fetchApi'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import type { GradesLocalDraft, TeacherGradeRow, TranslateFn } from './types'

interface RawStudentItem {
  id: string
  firstName?: string | null
  lastName?: string | null
}

interface RosterStudent {
  id: string
  firstName: string
  lastName: string
  className?: string
}

export interface LoadedGradesPayload {
  baseRows: TeacherGradeRow[]
  draft: GradesLocalDraft | null
  initialNotes: Record<string, number>
  initialObservations: Record<string, string>
  rosterLabel: string | null
}

export async function loadOnlineGradesData(
  selectedClass: string,
  selectedSubject: string,
  selectedSequence: string,
  t: TranslateFn,
): Promise<LoadedGradesPayload> {
  const draftKey = `draft:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`
  const unknownLabel = t('grades_section.unknown_student')

  // 1. Récupération systématique de la liste exhaustive des élèves de la classe
  let allClassStudents: { id: string; firstName: string; lastName: string; name: string }[] = []
  try {
    const classStudentsRes = await fetchApi(`/api/v2/classes/${selectedClass}/students`, { credentials: 'include' }).then(r => r.json())
    if (classStudentsRes.success && Array.isArray(classStudentsRes.data) && classStudentsRes.data.length > 0) {
      allClassStudents = (classStudentsRes.data as RawStudentItem[]).map((s) => ({
        id: s.id,
        firstName: s.firstName || '',
        lastName: s.lastName || '',
        name: `${s.firstName || ''} ${s.lastName || ''}`.trim() || unknownLabel,
      }))
    }
  } catch { /* repli sur users */ }

  if (allClassStudents.length === 0) {
    try {
      const usersRes = await fetchApi(`/api/v2/users?role=STUDENT&classId=${selectedClass}&limit=100`, { credentials: 'include' }).then(r => r.json())
      if (usersRes.success && Array.isArray(usersRes.data) && usersRes.data.length > 0) {
        allClassStudents = (usersRes.data as RawStudentItem[]).map((u) => ({
          id: u.id,
          firstName: u.firstName || '',
          lastName: u.lastName || '',
          name: `${u.firstName || ''} ${u.lastName || ''}`.trim() || unknownLabel,
        }))
      }
    } catch { /* ignore */ }
  }

  // 2. Récupération des notes existantes pour cette séquence
  const url = `/api/v2/grades?classId=${selectedClass}&subjectId=${selectedSubject}&sequenceId=${selectedSequence}`
  const res = await fetchApi(url, { credentials: 'include' }).then(r => r.json()).catch(() => ({ grades: [] }))
  const gradesByStudentId = new Map<string, TeacherGradeRow>()
  if (Array.isArray(res.grades)) {
    (res.grades as TeacherGradeRow[]).forEach((g) => gradesByStudentId.set(g.studentId, g))
  }

  // 3. Fusion : chaque élève de la classe apparaît, avec sa note existante ou vide
  let baseRows: TeacherGradeRow[] = allClassStudents.map(s => {
    const existing = gradesByStudentId.get(s.id)
    if (existing) return existing
    return {
      studentId: s.id,
      student: { id: s.id, firstName: s.firstName, lastName: s.lastName },
      sequenceScore: null,
      sequenceAverage: null,
      observation: '',
    }
  })

  if (Array.isArray(res.grades)) {
    for (const g of res.grades as TeacherGradeRow[]) {
      if (!baseRows.some(r => r.studentId === g.studentId)) {
        baseRows.push(g)
      }
    }
  }

  const cachedDraft = await getCachedData<GradesLocalDraft>(draftKey)
  const initialNotes: Record<string, number> = {}
  const initialObservations: Record<string, string> = {}
  if (!cachedDraft) {
    baseRows.forEach((r) => {
      initialNotes[r.studentId] = r.sequenceScore ?? r.sequenceAverage ?? 0
      initialObservations[r.studentId] = r.observation || ''
    })
  }

  // Créneau électif (LV2 ou A-Level) : restreindre aux élèves ayant réellement cette matière
  let rosterLabel: string | null = null
  if (selectedSubject) {
    try {
      const roster = await fetchApi(`/api/v2/teacher/roster?classId=${selectedClass}&subjectId=${selectedSubject}`, { credentials: 'include' }).then(r => r.json())
      if (roster?.success && roster.data.filtered) {
        const byId = new Map(baseRows.map((g) => [g.studentId, g]))
        const rosterStudents = roster.data.students as RosterStudent[]
        baseRows = rosterStudents.map((s) => {
          const existing = byId.get(s.id)
          const student = existing?.student ?? { id: s.id, firstName: s.firstName, lastName: s.lastName }
          return { ...(existing ?? { studentId: s.id }), student: { ...student, className: s.className } }
        })
        rosterLabel = roster.data.label
        const allowed = new Set<string>(rosterStudents.map((s) => s.id))
        for (const key of Object.keys(initialNotes)) {
          if (!allowed.has(key)) delete initialNotes[key]
        }
        for (const key of Object.keys(initialObservations)) {
          if (!allowed.has(key)) delete initialObservations[key]
        }
      }
    } catch { /* réseau : on garde la liste complète */ }
  }

  await putCachedData(`teacher:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`, baseRows)

  return {
    baseRows,
    draft: cachedDraft ? cachedDraft.data : null,
    initialNotes,
    initialObservations,
    rosterLabel,
  }
}
