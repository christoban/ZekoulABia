import { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { getCachedData, putCachedData, deleteCachedData } from '@/lib/offline/db'
import { OfflineActionRefusedError } from '@/lib/offline/actionRegistry'
import { loadOnlineGradesData } from './gradesLoader'
import type {
  TeacherClassOption,
  TeacherSubjectOption,
  TeacherSequenceOption,
  TeacherGradeRow,
  GradesImportResult,
  GradesLocalDraft,
  TranslateFn,
} from './types'

interface UseTeacherGradesParams {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  t: TranslateFn
}

export function useTeacherGrades({ onToast, t }: UseTeacherGradesParams) {
  const [classes, setClasses] = useState<TeacherClassOption[]>([])
  const [subjects, setSubjects] = useState<TeacherSubjectOption[]>([])
  const [sequences, setSequences] = useState<TeacherSequenceOption[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedSequence, setSelectedSequence] = useState('')
  const [grades, setGrades] = useState<TeacherGradeRow[]>([])
  const [notes, setNotes] = useState<Record<string, number>>({})
  const [observations, setObservations] = useState<Record<string, string>>({})
  const [rejectedGrades, setRejectedGrades] = useState<TeacherGradeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rosterLabel, setRosterLabel] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showDraftPrompt, setShowDraftPrompt] = useState(false)
  const [localDraft, setLocalDraft] = useState<GradesLocalDraft | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<GradesImportResult | null>(null)

  const { isOnline, addToQueue } = useSyncQueue()

  useEffect(() => {
    if (navigator.onLine) {
      Promise.all([
        fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
        fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()),
        fetchApi('/api/v2/academic-years', { credentials: 'include' }).then(r => r.json()),
        fetchApi('/api/v2/grades?validationStatus=REJECTED', { credentials: 'include' }).then(r => r.json()),
      ]).then(async ([clsRes, subRes, ayRes, rejRes]) => {
        if (clsRes.success) {
          setClasses(clsRes.data)
          await putCachedData('teacher:classes', clsRes.data)
        }
        if (subRes.success) {
          setSubjects(subRes.data)
          await putCachedData('teacher:subjects', subRes.data)
        }
        if (ayRes.success) {
          interface AySeqRaw { id: string; name: string; [key: string]: unknown }
          interface AyPeriodRaw { name: string; sequences?: AySeqRaw[] }
          interface AyYearRaw { id: string; periods?: AyPeriodRaw[] }
          const seqs: TeacherSequenceOption[] = (ayRes.data as AyYearRaw[]).flatMap((ay) =>
            ay.periods?.flatMap((p) =>
              p.sequences?.map((s) => ({ ...s, periodName: p.name, academicYearId: ay.id })) || []
            ) || []
          )
          setSequences(seqs)
          await putCachedData('teacher:sequences', seqs)
        }
        if (rejRes.grades) setRejectedGrades(rejRes.grades)
      }).catch(() => {}).finally(() => setLoading(false))
    } else {
      Promise.all([
        getCachedData<TeacherClassOption[]>('teacher:classes'),
        getCachedData<TeacherSubjectOption[]>('teacher:subjects'),
        getCachedData<TeacherSequenceOption[]>('teacher:sequences'),
      ]).then(([clsCache, subCache, seqCache]) => {
        if (clsCache) setClasses(clsCache.data)
        if (subCache) setSubjects(subCache.data)
        if (seqCache) setSequences(seqCache.data)
      }).catch(() => {}).finally(() => setLoading(false))
    }
  }, [])

  const loadGrades = async () => {
    if (!selectedClass || !selectedSubject || !selectedSequence) {
      onToast(t('grades_section.toast_select_filters'), 'warning')
      return
    }
    setLoading(true)
    setError(null)
    setRosterLabel(null)
    const draftKey = `draft:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`
    try {
      if (!isOnline) {
        const cached = await getCachedData<TeacherGradeRow[]>(`teacher:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`)
        const draft = await getCachedData<GradesLocalDraft>(draftKey)
        if (cached) {
          setGrades(cached.data)
          if (draft) {
            setLocalDraft(draft.data)
            setShowDraftPrompt(true)
          } else {
            const n: Record<string, number> = {}
            const o: Record<string, string> = {}
            cached.data.forEach((g) => {
              n[g.studentId] = g.sequenceScore ?? 0
              o[g.studentId] = g.observation || ''
            })
            setNotes(n)
            setObservations(o)
          }
        } else {
          setGrades([])
          onToast(t('grades_section.toast_no_cache'), 'warning')
        }
        return
      }

      const loaded = await loadOnlineGradesData(selectedClass, selectedSubject, selectedSequence, t)
      if (loaded.draft) {
        setLocalDraft(loaded.draft)
        setShowDraftPrompt(true)
      } else {
        setNotes(loaded.initialNotes)
        setObservations(loaded.initialObservations)
      }
      if (loaded.rosterLabel) setRosterLabel(loaded.rosterLabel)
      setGrades(loaded.baseRows)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('grades_section.toast_error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (selectedClass && selectedSubject && selectedSequence) {
      loadGrades()
    }
  }, [selectedClass, selectedSubject, selectedSequence]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'grade' && selectedClass && selectedSubject && selectedSequence) loadGrades()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [selectedClass, selectedSubject, selectedSequence]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveDraft = async () => {
    if (!selectedClass || !selectedSubject || !selectedSequence) return
    const gradesPayload = Object.entries(notes).map(([studentId, value]) => ({
      studentId, value, observation: observations[studentId] || '',
    }))
    const draftKey = `draft:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`

    if (!isOnline) {
      await putCachedData(draftKey, { notes, observations })
      await addToQueue({
        type: 'GRADE_DRAFT_SAVE',
        endpoint: '/api/v2/grades/draft',
        method: 'POST',
        payload: { classId: selectedClass, subjectId: selectedSubject, sequenceId: selectedSequence, grades: gradesPayload },
      })
      onToast(t('grades_section.toast_draft_saved_local'), 'info')
      return
    }

    setSaving(true)
    try {
      const res = await fetchApi('/api/v2/grades/draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClass, subjectId: selectedSubject, sequenceId: selectedSequence, grades: gradesPayload }),
      }).then(r => r.json())
      if (res.success) {
        onToast(t('grades_section.toast_draft_saved'), 'info')
        await deleteCachedData(draftKey)
      } else {
        onToast(res.message || t('grades_section.toast_error'), 'error')
      }
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : t('grades_section.toast_error'), 'error')
    } finally {
      setSaving(false)
    }
  }

  const submitGrades = async () => {
    if (!selectedClass || !selectedSubject || !selectedSequence) return
    const draftKey = `draft:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`
    const gradesPayload = Object.entries(notes).map(([studentId, value]) => ({
      studentId, value, observation: observations[studentId] || '',
    }))

    setSaving(true)
    try {
      if (!isOnline) {
        await addToQueue({
          type: 'GRADE',
          endpoint: '/api/v2/grades/bulk-lock',
          method: 'POST',
          payload: { classId: selectedClass, sequenceId: selectedSequence },
        })
        onToast(t('grades_section.toast_submit_queued'), 'warning')
        return
      }

      const draftRes = await fetchApi('/api/v2/grades/draft', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClass, subjectId: selectedSubject, sequenceId: selectedSequence, grades: gradesPayload }),
      }).then(r => r.json())
      if (!draftRes.success) {
        onToast(draftRes.message || t('grades_section.toast_submit_error'), 'error')
        return
      }

      const res = await fetchApi('/api/v2/grades/bulk-lock', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId: selectedClass, sequenceId: selectedSequence }),
      }).then(r => r.json())
      if (res.success) {
        onToast(res.data?.message || t('grades_section.toast_submitted').replace('{count}', String(res.data?.notesVerrouillees ?? '?')), 'success')
        await deleteCachedData(draftKey)
        loadGrades()
      } else {
        onToast(res.message || t('grades_section.toast_error'), 'error')
      }
    } catch (err: unknown) {
      onToast(err instanceof OfflineActionRefusedError ? err.message : (err instanceof Error ? err.message : t('grades_section.toast_error')), 'error')
    } finally {
      setSaving(false)
    }
  }

  const downloadTemplate = () => {
    if (!selectedClass || !selectedSubject || !selectedSequence) {
      onToast(t('grades_section.toast_select_template'), 'warning')
      return
    }
    const url = `/api/v2/grades/template?classId=${selectedClass}&subjectId=${selectedSubject}&sequenceId=${selectedSequence}`
    const a = document.createElement('a')
    a.href = url
    a.click()
  }

  const importFromExcel = async (file: File) => {
    if (!selectedClass || !selectedSubject || !selectedSequence) {
      onToast(t('grades_section.toast_select_import'), 'warning')
      return
    }
    setImporting(true)
    setImportResult(null)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('classId', selectedClass)
    formData.append('subjectId', selectedSubject)
    formData.append('sequenceId', selectedSequence)
    try {
      const res = await fetchApi('/api/v2/grades/import', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      }).then(r => r.json())
      if (res.success) {
        setImportResult(res)
        onToast(
          t('grades_section.toast_import_result').replace('{imported}', String(res.imported)) + (res.errors.length > 0 ? ` · ${t('grades_section.toast_import_errors').replace('{count}', String(res.errors.length))}` : ''),
          res.errors.length > 0 ? 'warning' : 'success',
        )
        loadGrades()
      } else {
        onToast(res.message || t('grades_section.toast_import_error'), 'error')
      }
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : t('grades_section.toast_import_error'), 'error')
    } finally {
      setImporting(false)
    }
  }

  const validatedCount = grades.filter((g) => g.validationStatus === 'VALIDATED' || g.validationStatus === 'LOCKED').length
  const draftCount = grades.filter((g) => g.validationStatus === 'DRAFT' || !g.validationStatus).length
  const rejectedCount = grades.filter((g) => g.validationStatus === 'REJECTED').length
  const modifiableCount = draftCount + rejectedCount

  return {
    classes, subjects, sequences,
    selectedClass, setSelectedClass,
    selectedSubject, setSelectedSubject,
    selectedSequence, setSelectedSequence,
    grades, notes, setNotes, observations, setObservations,
    rejectedGrades, loading, error, rosterLabel, saving,
    showDraftPrompt, setShowDraftPrompt, localDraft,
    importing, importResult, setImportResult,
    isOnline, validatedCount, draftCount, rejectedCount, modifiableCount,
    loadGrades, saveDraft, submitGrades, downloadTemplate, importFromExcel,
  }
}
