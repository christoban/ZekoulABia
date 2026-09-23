'use client'
import { useState, useEffect } from 'react'
import { WifiOff, Save, Target, AlertTriangle, CheckCircle2, X, Download, Upload, Loader2, RefreshCw, Pencil } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { getCachedData, putCachedData, deleteCachedData } from '@/lib/offline/db'
import { OfflineActionRefusedError } from '@/lib/offline/actionRegistry'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

export default function SectionTeacherGrades({ onToast, user }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const [classes, setClasses] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [sequences, setSequences] = useState<any[]>([])
  const [selectedClass, setSelectedClass] = useState('')
  const [selectedSubject, setSelectedSubject] = useState('')
  const [selectedSequence, setSelectedSequence] = useState('')
  const [grades, setGrades] = useState<any[]>([])
  const [notes, setNotes] = useState<Record<string, number>>({})
  const [observations, setObservations] = useState<Record<string, string>>({})
  const [rejectedGrades, setRejectedGrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rosterLabel, setRosterLabel] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [showDraftPrompt, setShowDraftPrompt] = useState(false)
  const [localDraft, setLocalDraft] = useState<{ notes: Record<string, number>; observations: Record<string, string> } | null>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; errors: { line: number; matricule: string; error: string }[]; total: number } | null>(null)

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
          const seqs = ayRes.data.flatMap((ay: any) =>
            ay.periods?.flatMap((p: any) =>
              p.sequences?.map((s: any) => ({ ...s, periodName: p.name, academicYearId: ay.id })) || []
            ) || []
          )
          setSequences(seqs)
          await putCachedData('teacher:sequences', seqs)
        }
        if (rejRes.grades) setRejectedGrades(rejRes.grades)
      }).catch(() => {}).finally(() => setLoading(false))
    } else {
      Promise.all([
        getCachedData<any[]>('teacher:classes'),
        getCachedData<any[]>('teacher:subjects'),
        getCachedData<any[]>('teacher:sequences'),
      ]).then(([clsCache, subCache, seqCache]) => {
        if (clsCache) setClasses(clsCache.data)
        if (subCache) setSubjects(subCache.data)
        if (seqCache) setSequences(seqCache.data)
      }).catch(() => {}).finally(() => setLoading(false))
    }
  }, [])

  // Rafraîchissement temps réel quand l'assistant IA saisit/soumet une note.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'grade' && selectedClass && selectedSubject && selectedSequence) loadGrades()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [selectedClass, selectedSubject, selectedSequence])  // eslint-disable-line react-hooks/exhaustive-deps

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
        const cached = await getCachedData<any[]>(`teacher:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`)
        const draft = await getCachedData<{ notes: Record<string, number>; observations: Record<string, string> }>(draftKey)
        if (cached) {
          setGrades(cached.data)
          if (draft) {
            setLocalDraft(draft.data as { notes: Record<string, number>; observations: Record<string, string> })
            setShowDraftPrompt(true)
          } else {
            const n: Record<string, number> = {}
            const o: Record<string, string> = {}
            ;(cached.data as any[]).forEach((g: any) => {
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

      const url = `/api/v2/grades?classId=${selectedClass}&subjectId=${selectedSubject}&sequenceId=${selectedSequence}`
      const res = await fetchApi(url, { credentials: 'include' }).then(r => r.json())
      let baseRows: any[] = []
      if (res.grades?.length) {
        baseRows = res.grades
        const draft = await getCachedData<{ notes: Record<string, number>; observations: Record<string, string> }>(draftKey)
        if (draft) {
          setLocalDraft(draft.data as { notes: Record<string, number>; observations: Record<string, string> })
          setShowDraftPrompt(true)
        } else {
          const n: Record<string, number> = {}
          const o: Record<string, string> = {}
          res.grades.forEach((g: any) => {
            n[g.studentId] = g.sequenceScore ?? g.sequenceAverage ?? 0
            o[g.studentId] = g.observation || ''
          })
          setNotes(n)
          setObservations(o)
        }
      } else {
        const usersRes = await fetchApi(`/api/v2/users?role=STUDENT&classId=${selectedClass}`, { credentials: 'include' }).then(r => r.json())
        if (usersRes.success) {
          baseRows = usersRes.data.map((u: any) => ({
            studentId: u.id,
            student: { id: u.id, firstName: u.firstName, lastName: u.lastName },
          }))
          const n: Record<string, number> = {}
          usersRes.data.forEach((u: any) => { n[u.id] = 0 })
          setNotes(n)
          setObservations({})
        }
      }

      // Créneau électif (LV2 ou A-Level) : restreindre aux élèves ayant réellement cette matière
      if (selectedSubject) {
        try {
          const roster = await fetchApi(`/api/v2/teacher/roster?classId=${selectedClass}&subjectId=${selectedSubject}`, { credentials: 'include' }).then(r => r.json())
          if (roster?.success && roster.data.filtered) {
            const byId = new Map(baseRows.map((g: any) => [g.studentId, g]))
            baseRows = roster.data.students.map((s: any) => {
              const existing = byId.get(s.id)
              const student = existing?.student ?? { id: s.id, firstName: s.firstName, lastName: s.lastName }
              return { ...(existing ?? { studentId: s.id }), student: { ...student, className: s.className } }
            })
            setRosterLabel(roster.data.label)
            // Restreindre la saisie aux seuls élèves du roster (évite d'enregistrer une note à un non-électeur)
            const allowed = new Set<string>(roster.data.students.map((s: any) => s.id))
            setNotes(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => allowed.has(id))))
            setObservations(prev => Object.fromEntries(Object.entries(prev).filter(([id]) => allowed.has(id))))
          }
        } catch { /* réseau : on garde la liste complète */ }
      }

      setGrades(baseRows)
      await putCachedData(`teacher:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`, baseRows)
    } catch (err: any) {
      setError(err.message || t('grades_section.toast_error'))
    } finally {
      setLoading(false)
    }
  }

  const saveDraft = async () => {
    if (!selectedClass || !selectedSubject || !selectedSequence) return
    const gradesPayload = Object.entries(notes).map(([studentId, value]) => ({
      studentId, value, observation: observations[studentId] || '',
    }))
    const draftKey = `draft:grades:${selectedClass}:${selectedSubject}:${selectedSequence}`

    if (!isOnline) {
      await putCachedData(draftKey, { notes, observations }) // affichage optimiste immédiat, inchangé
      // Correctif critique : sans cette ligne, les valeurs saisies hors ligne n'étaient JAMAIS mises
      // en file d'attente réelle — seulement mises en cache de lecture (disposable, effacé à la
      // déconnexion). Voir CORRECTION A du document de revue.
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
    } catch (err: any) {
      onToast(err.message, 'error')
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

    // Le verrouillage (DRAFT→LOCKED) est irréversible — la garde vient du registre
    // (GRADE = FORT → addToQueue lève OfflineActionRefusedError hors-ligne), plus du composant.
    // Le brouillon reste sauvegardé localement via saveDraft().
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
    } catch (err: any) {
      onToast(err.message, 'error')
    } finally {
      setImporting(false)
    }
  }

  const validatedCount = grades.filter((g: any) => g.validationStatus === 'VALIDATED' || g.validationStatus === 'LOCKED').length
  const draftCount = grades.filter((g: any) => g.validationStatus === 'DRAFT' || !g.validationStatus).length
  const rejectedCount = grades.filter((g: any) => g.validationStatus === 'REJECTED').length
  const modifiableCount = draftCount + rejectedCount

  if (loading && !grades.length) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>
          <button onClick={loadGrades}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 13px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            <RefreshCw size={13} strokeWidth={2} />{t('grades_section.retry')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={sTitle}>{t('grades_section.title')}</div>
          <div style={sSub}>{t('grades_section.subtitle')}</div>
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 8, padding: '8px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={15} strokeWidth={2} /></span>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--amber)' }}>{t('grades_section.offline_banner')}</span>
        </div>
      )}

      {/* Prompt restauration brouillon */}
      {showDraftPrompt && localDraft && (
        <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><Save size={18} strokeWidth={2} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--amber)' }}>{t('grades_section.draft_prompt_title')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--amber)', marginTop: 1 }}>{t('grades_section.draft_prompt_desc')}</div>
          </div>
          <button onClick={() => { setNotes(localDraft.notes); setObservations(localDraft.observations); setShowDraftPrompt(false) }}
            style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 800, background: 'var(--amber)', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('grades_section.draft_prompt_restore')}
          </button>
          <button onClick={() => setShowDraftPrompt(false)}
            style={{ padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('grades_section.draft_prompt_ignore')}
          </button>
        </div>
      )}

      {grades.length > 0 && (
        <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
            <span>{classes.find((c: any) => c.id === selectedClass)?.name || ''} — {subjects.find((s: any) => s.id === selectedSubject)?.name || ''}</span>
            <span style={{ color: 'var(--green)' }}>{t('grades_section.progress_text').replace('{validated}', String(validatedCount)).replace('{total}', String(grades.length)).replace('{pct}', String(grades.length ? Math.round(validatedCount / grades.length * 100) : 0))}</span>
          </div>
          <div style={{ height: 6, background: 'var(--border2)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${grades.length ? Math.round(validatedCount / grades.length * 100) : 0}%`, background: 'var(--green)', borderRadius: 6, transition: 'width 1s' }} />
          </div>
        </div>
      )}

      {/* Filtres + table */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1.5px solid var(--border)', overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select style={filterSt} value={selectedClass} onChange={e => setSelectedClass(e.target.value)}>
            <option value="">{t('grades_section.filter_class')}</option>
            {classes.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select style={filterSt} value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}>
            <option value="">{t('grades_section.filter_subject')}</option>
            {subjects.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select style={filterSt} value={selectedSequence} onChange={e => setSelectedSequence(e.target.value)}>
            <option value="">{t('grades_section.filter_sequence')}</option>
            {sequences.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button style={btnPrim} onClick={loadGrades} disabled={loading}>{t('grades_section.load')}</button>
          <div style={{ flex: 1 }} />
          <button
            style={{ ...btnSec, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 5 }}
            onClick={downloadTemplate}
            title={t('grades_section.template_tooltip')}>
            <Download size={13} strokeWidth={2} />{t('grades_section.download_template')}
          </button>
          <label style={{ ...btnSec, fontSize: 12.5, display: 'inline-flex', alignItems: 'center', gap: 5, cursor: importing ? 'not-allowed' : 'pointer', opacity: importing ? 0.6 : 1 }}>
            {importing ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <Upload size={13} strokeWidth={2} />}
            {importing ? t('grades_section.import_loading') : t('grades_section.import_excel')}
            <input
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              disabled={importing}
              onChange={e => {
                const file = e.target.files?.[0]
                if (file) { importFromExcel(file); e.target.value = '' }
              }}
            />
          </label>
        </div>

        {rosterLabel && (
          <div style={{ background: 'var(--blue-light)', border: '1.5px solid var(--blue)', borderRadius: 8, padding: '8px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center' }}><Target size={15} strokeWidth={2} /></span>
            <span style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--blue)' }}>{rosterLabel}</span>
          </div>
        )}

        {importResult && (
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: importResult.errors.length > 0 ? 8 : 0 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontWeight: 800, fontSize: 13, color: importResult.errors.length > 0 ? 'var(--amber)' : 'var(--green)' }}>
                {importResult.errors.length > 0 ? <AlertTriangle size={14} strokeWidth={2} /> : <CheckCircle2 size={14} strokeWidth={2} />}
                {t('grades_section.toast_import_result').replace('{imported}', String(importResult.imported))}
                {importResult.errors.length > 0 && ` · ${t('grades_section.toast_import_errors').replace('{count}', String(importResult.errors.length))}`}
              </span>
              <button
                onClick={() => setImportResult(null)}
                style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}>
                <X size={15} strokeWidth={2} />
              </button>
            </div>
            {importResult.errors.length > 0 && (
              <div style={{ background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 7, overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                    <thead>
                      <tr>
                        {[t('grades_section.import_table_line'), t('grades_section.import_table_matricule'), t('grades_section.import_table_error')].map(h => (
                          <th key={h} style={{ ...thSt, background: 'var(--red-light)', color: 'var(--red)', padding: '6px 10px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importResult.errors.map((e, i) => (
                        <tr key={i} style={{ borderTop: '1px solid rgba(220,38,38,0.1)' }}>
                          <td style={{ ...tdSt, color: 'var(--red)', fontWeight: 700, width: 50 }}>{e.line}</td>
                          <td style={{ ...tdSt, fontWeight: 700 }}>{e.matricule || '—'}</td>
                          <td style={{ ...tdSt, color: 'var(--red)' }}>{e.error}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {grades.length > 0 && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                <thead>
                  <tr>{[t('grades_section.table_num'), t('grades_section.table_student'), t('grades_section.table_grade'), t('grades_section.table_observation'), t('grades_section.table_status')].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {grades.map((g: any, i: number) => {
                    const sid = g.studentId || g.student?.id
                    const name = g.student ? `${g.student.firstName} ${g.student.lastName}` : t('grades_section.unknown_student')
                    const status = g.validationStatus || 'DRAFT'
                    const sColors: Record<string, { bg: string; color: string }> = {
                      DRAFT: { bg: 'var(--bg2)', color: 'var(--text2)' },
                      SUBMITTED: { bg: 'var(--amber-light)', color: 'var(--amber)' },
                      VALIDATED: { bg: 'var(--green-light)', color: 'var(--green)' },
                      REJECTED: { bg: 'var(--red-light)', color: 'var(--red)' },
                      LOCKED: { bg: 'var(--blue-light)', color: 'var(--blue)' },
                    }
                    const sc = sColors[status] || sColors.DRAFT
                    return (
                      <tr key={sid}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <td style={{ ...tdSt, color: 'var(--text3)', width: 38 }}>{i + 1}</td>
                        <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                          {name}
                          {rosterLabel && g.student?.className && <span style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11.5 }}> ({g.student.className})</span>}
                        </td>
                        <td style={tdSt}>
                          <input type="number" min={0} max={20} step={0.25}
                            value={notes[sid] ?? 0}
                            onChange={e => {
                              const a = { ...notes }
                              a[sid] = Number(e.target.value)
                              setNotes(a)
                            }}
                            disabled={status !== 'DRAFT' && status !== 'REJECTED'}
                            style={{ width: 68, padding: '5px 8px', border: '1.5px solid var(--border2)', borderRadius: 7, fontSize: 13.5, fontWeight: 800, textAlign: 'center', fontFamily: 'inherit', outline: 'none', background: status !== 'DRAFT' && status !== 'REJECTED' ? 'var(--bg2)' : 'white', color: (notes[sid] ?? 0) < 10 ? 'var(--red)' : (notes[sid] ?? 0) >= 16 ? 'var(--green)' : 'var(--text)' }}
                          />
                        </td>
                        <td style={tdSt}>
                          <input type="text" value={observations[sid] || ''} placeholder={t('grades_section.observation_placeholder')}
                            onChange={e => {
                              const a = { ...observations }
                              a[sid] = e.target.value
                              setObservations(a)
                            }}
                            disabled={status !== 'DRAFT' && status !== 'REJECTED'}
                            style={{ width: 200, padding: '5px 9px', border: '1.5px solid var(--border2)', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: status !== 'DRAFT' && status !== 'REJECTED' ? 'var(--bg2)' : 'white', color: 'var(--text)' }}
                          />
                        </td>
                        <td style={tdSt}>
                          <span style={{ padding: '2.5px 8px', borderRadius: 14, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>
                            {status === 'DRAFT' ? t('grades_section.status_draft') : status === 'SUBMITTED' ? t('grades_section.status_submitted') : status === 'VALIDATED' ? t('grades_section.status_validated') : status === 'REJECTED' ? t('grades_section.status_rejected') : status === 'LOCKED' ? t('grades_section.status_locked') : status}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
                {t('grades_section.summary_draft').replace('{count}', String(draftCount))}{rejectedCount > 0 ? ` · ${t('grades_section.summary_rejected').replace('{count}', String(rejectedCount))}` : ''} · {t('grades_section.summary_submitted').replace('{count}', String(grades.filter((g: any) => g.validationStatus === 'SUBMITTED').length))}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                {modifiableCount > 0 ? (
                  <>
                    <button style={{ ...btnSec, display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={saveDraft} disabled={saving}>
                      {saving ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <Save size={13} strokeWidth={2} />}
                      {saving ? '...' : t('grades_section.draft_save')}
                    </button>
                    <button style={{ ...btnPrim, display: 'inline-flex', alignItems: 'center', gap: 5, opacity: !isOnline ? 0.5 : 1, cursor: !isOnline ? 'not-allowed' : 'pointer' }} onClick={submitGrades} disabled={saving || !isOnline}>
                      {!isOnline ? <WifiOff size={13} strokeWidth={2} /> : <Upload size={13} strokeWidth={2} />}
                      {saving ? '...' : isOnline ? t('grades_section.submit_online') : t('grades_section.submit_offline')}
                    </button>
                  </>
                ) : (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>
                    <CheckCircle2 size={14} strokeWidth={2} />
                    {t('grades_section.all_submitted')}
                  </span>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Notes rejetées */}
      {rejectedGrades.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1.5px solid rgba(220,38,38,0.3)', overflow: 'hidden' }}>
          <div style={{ padding: '8px 14px', background: 'var(--red-light)', borderBottom: '1px solid rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', gap: 6 }}>
            <X size={14} strokeWidth={2} color="var(--red)" />
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)' }}>{t('grades_section.rejected_title').replace('{count}', String(rejectedGrades.length))}</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
              <thead><tr>{[t('grades_section.rejected_table_student'), t('grades_section.rejected_table_grade'), t('grades_section.rejected_table_reason'), t('grades_section.rejected_table_actions')].map(h => <th key={h} style={thSt}>{h}</th>)}</tr></thead>
              <tbody>
                {rejectedGrades.map((g: any) => (
                  <tr key={g.id}>
                    <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{g.student?.firstName} {g.student?.lastName}</td>
                    <td style={{ ...tdSt, fontWeight: 800, color: 'var(--red)' }}>{g.sequenceScore ?? '?'}/20</td>
                    <td style={{ ...tdSt, color: 'var(--red)', fontWeight: 700 }}>{g.rejectionReason || t('grades_section.rejected_no_reason')}</td>
                    <td style={tdSt}>
                      <button
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 800, background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid rgba(217,119,6,0.3)', cursor: 'pointer', fontFamily: 'inherit' }}
                        onClick={() => {
                          setSelectedClass(g.classId || '')
                          setSelectedSubject(g.subjectId || '')
                          setSelectedSequence(g.sequenceId || '')
                          loadGrades()
                        }}>
                        <Pencil size={13} strokeWidth={2} />{t('grades_section.rejected_correct')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = { padding: '6px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '6px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 7, padding: '6px 10px', fontSize: 12.5, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '8.5px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
