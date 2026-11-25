'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, ClipboardList, BookOpen, Loader2, Check, GraduationCap, WifiOff, Package } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { confirmAction } from '@/components/shell/ConfirmDialog'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { putCachedData, getCachedData } from '@/lib/offline/db'
import { AssignmentGenerationPanel, GenerateAllBanner, type GenerationResult } from './AssignmentGenerationPanel'

interface ClassItem {
  id: string
  name: string
  level: string | null
  academicYearId?: string
}

interface AssignmentRow {
  subjectId: string
  subjectName: string
  coefficient: number
  currentTeacherId: string | null
  currentTeacherName: string | null
  currentSource?: 'MANUAL' | 'GENERATED' | 'UNKNOWN' | null
  eligibleTeachers: { id: string; name: string }[]
}

interface AssignmentError {
  subjectId: string
  code: 'AP_WEEKLY_CAP_EXCEEDED' | 'TEACHER_WEEKLY_CAP_EXCEEDED'
  currentLoad: number
  candidateLoad: number
  suggestions: { teacherId: string; firstName: string; lastName: string; chargeHeures: number }[]
}

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  namespace?: 'admin' | 'staff'
  allowAutoGenerate?: boolean
}

const sScroll: React.CSSProperties = { height: '100%', overflowY: 'auto' }
const sCard: React.CSSProperties = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '14px 18px' }
const sLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }
const sSelect: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit', cursor: 'pointer' }

export default function TeachingAssignmentsView({ onToast, namespace = 'staff', allowAutoGenerate = false }: Props) {
  const tAdmin = useT('admin')
  const tStaff = useT('staff')
  const isAdmin = namespace === 'admin'

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [classId, setClassId] = useState('')
  const [rows, setRows] = useState<AssignmentRow[]>([])
  const [meta, setMeta] = useState<{ total: number; assigned: number } | null>(null)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [assignmentError, setAssignmentError] = useState<AssignmentError | null>(null)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const [fromCache, setFromCache] = useState(false)
  const [cachedAt, setCachedAt] = useState<number | null>(null)
  const { isOnline, addToQueue } = useSyncQueue()

  useEffect(() => {
    let mounted = true
    getCachedData<ClassItem[]>(`${namespace}:classes`).then(cached => {
      if (mounted && cached?.data && Array.isArray(cached.data)) setClasses(cached.data)
    }).catch(() => {})

    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json())
      .then((d: { data?: ClassItem[] } | ClassItem[]) => {
        if (!mounted) return
        const rawList = Array.isArray(d) ? d : Array.isArray(d?.data) ? d.data : []
        const formatted = rawList.map((c) => ({ id: c.id, name: c.name, level: c.level, academicYearId: c.academicYearId }))
        if (formatted.length > 0) {
          setClasses(formatted)
          void putCachedData(`${namespace}:classes`, formatted)
        }
      })
      .catch(() => {})
      .finally(() => { if (mounted) setLoadingClasses(false) })

    return () => { mounted = false }
  }, [namespace])

  const loadAssignments = useCallback(async (cid: string) => {
    if (!cid) { setRows([]); setMeta(null); return }
    setLoadingRows(true)
    try {
      const res = await fetchApi(`/api/v2/teaching-assignments?classId=${cid}`, { credentials: 'include' })
      const d = await res.json() as { success?: boolean; data?: AssignmentRow[]; meta?: { total: number; assigned: number } }
      if (d.success && d.data) {
        setRows(d.data)
        setMeta(d.meta ?? null)
        setFromCache(false)
        setCachedAt(null)
        void putCachedData(`${namespace}:teaching-assignments:${cid}`, { rows: d.data, meta: d.meta })
      }
    } catch {
      try {
        const cached = await getCachedData<{ rows: AssignmentRow[]; meta: { total: number; assigned: number } }>(`${namespace}:teaching-assignments:${cid}`)
        if (cached?.data?.rows) {
          setRows(cached.data.rows)
          setMeta(cached.data.meta)
          setFromCache(true)
          setCachedAt(cached.cachedAt)
        } else {
          onToast('Erreur lors du chargement des affectations', 'error')
        }
      } catch {
        onToast('Erreur lors du chargement des affectations', 'error')
      }
    } finally {
      setLoadingRows(false)
    }
  }, [namespace, onToast])

  const handleClassChange = (cid: string) => {
    setClassId(cid)
    setGenerationResult(null)
    void loadAssignments(cid)
  }

  const applyAssignmentLocally = (subjectId: string, teacherId: string | null) => {
    setRows(prev => prev.map(r => r.subjectId === subjectId
      ? {
          ...r,
          currentTeacherId: teacherId,
          currentTeacherName: teacherId ? (r.eligibleTeachers.find(t => t.id === teacherId)?.name ?? null) : null,
          currentSource: teacherId ? 'MANUAL' : null,
        }
      : r))
    setMeta(prev => {
      if (!prev) return prev
      const wasAssigned = rows.find(r => r.subjectId === subjectId)?.currentTeacherId !== null
      const nowAssigned = teacherId !== null
      if (wasAssigned === nowAssigned) return prev
      return { ...prev, assigned: prev.assigned + (nowAssigned ? 1 : -1) }
    })
  }

  const handleClearClass = async () => {
    const selectedClass = classes.find(c => c.id === classId)
    if (!selectedClass || !(await confirmAction(tStaff('affectations.clearClassConfirm', { className: selectedClass.name })))) return
    setClearing(true)
    try {
      const res = await fetchApi('/api/v2/teaching-assignments/clear-class', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      })
      const data = await res.json() as { message?: string; data?: { count: number } }
      if (!res.ok) throw new Error(data.message || tStaff('affectations.clearClassError'))
      onToast(tStaff('affectations.clearClassSuccess', { count: data.data?.count ?? 0 }), 'success')
      void loadAssignments(classId)
    } catch (error: unknown) {
      onToast(error instanceof Error ? error.message : tStaff('affectations.clearClassError'), 'error')
    } finally {
      setClearing(false)
    }
  }

  const handleAssign = async (subjectId: string, teacherId: string | null) => {
    const payload = { classId, subjectId, teacherId }
    setAssignmentError(null)
    if (!isOnline) {
      await addToQueue({ type: 'TEACHER_ASSIGNMENT', endpoint: '/api/v2/teaching-assignments', method: 'POST', payload })
      applyAssignmentLocally(subjectId, teacherId)
      onToast("Affectation mise en file d'attente — synchronisation à la reconnexion", 'success')
      return
    }
    setSaving(subjectId)
    try {
      const res = await fetchApi('/api/v2/teaching-assignments', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json() as {
        message?: string
        error?: { code?: string; currentLoad?: number; candidateLoad?: number; suggestions?: AssignmentError['suggestions'] }
      }
      if (res.status === 409 && (d.error?.code === 'AP_WEEKLY_CAP_EXCEEDED' || d.error?.code === 'TEACHER_WEEKLY_CAP_EXCEEDED')) {
        setAssignmentError({
          subjectId,
          code: d.error.code,
          currentLoad: d.error.currentLoad ?? 0,
          candidateLoad: d.error.candidateLoad ?? 0,
          suggestions: d.error.suggestions ?? [],
        })
        onToast(tStaff(d.error.code === 'TEACHER_WEEKLY_CAP_EXCEEDED' ? 'affectations.weeklyCapExceeded' : 'affectations.apCapExceeded'), 'error')
        return
      }
      if (!res.ok) throw new Error(d.message || 'Erreur')
      applyAssignmentLocally(subjectId, teacherId)
      onToast(teacherId ? 'Affectation enregistrée' : 'Affectation supprimée', 'success')
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setSaving(null)
    }
  }

  const handleGenerateAll = async () => {
    const academicYearId = classes[0]?.academicYearId
    if (!academicYearId || !(await confirmAction(tStaff('affectations.generateAllConfirm')))) return
    setGeneratingAll(true)
    try {
      const res = await fetchApi('/api/v2/teaching-assignments/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicYearId, rebalanceExisting: false }),
      })
      const data = await res.json() as { message?: string; data: GenerationResult }
      if (!res.ok) throw new Error(data.message || tStaff('affectations.generateError'))
      setGenerationResult(data.data)
      onToast(tStaff('affectations.generateAllSuccess', { count: data.data.createdCount }), 'success')
    } catch (error: unknown) {
      onToast(error instanceof Error ? error.message : tStaff('affectations.generateError'), 'error')
    } finally {
      setGeneratingAll(false)
    }
  }

  const selectedClass = classes.find(c => c.id === classId)

  const handleGenerate = async () => {
    if (!classId || !selectedClass?.academicYearId) return
    if (!(await confirmAction(tStaff('affectations.generateConfirmNoRebalance')))) return
    setGenerating(true)
    setGenerationResult(null)
    try {
      const res = await fetchApi('/api/v2/teaching-assignments/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, academicYearId: selectedClass.academicYearId, rebalanceExisting: false }),
      })
      const d = await res.json() as { message?: string; data: GenerationResult }
      if (!res.ok) throw new Error(d.message || 'Erreur')
      setGenerationResult(d.data)
      void loadAssignments(classId)
      onToast(tStaff('affectations.generateSuccess', { count: d.data.createdCount }), 'success')
    } catch (err: unknown) {
      onToast(err instanceof Error ? err.message : tStaff('affectations.generateError'), 'error')
    } finally {
      setGenerating(false)
    }
  }

  const renderAssignmentError = (subjectId: string) => {
    if (assignmentError?.subjectId !== subjectId) return null
    return (
      <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'var(--red-light)', border: '1px solid var(--red-light)', fontSize: 11.5, color: 'var(--red)' }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>
          {tStaff(assignmentError.code === 'TEACHER_WEEKLY_CAP_EXCEEDED' ? 'affectations.weeklyCapExceeded' : 'affectations.apCapExceeded', {
            current: assignmentError.currentLoad,
            candidate: assignmentError.candidateLoad,
          })}
        </div>
        {assignmentError.suggestions.length > 0 ? (
          <div>
            <div style={{ marginBottom: 2 }}>{tStaff('affectations.apCapSuggestions')} :</div>
            {assignmentError.suggestions.map((s) => (
              <button
                key={s.teacherId}
                type="button"
                onClick={() => void handleAssign(subjectId, s.teacherId)}
                style={{ display: 'block', textAlign: 'left', background: 'transparent', border: 'none', padding: '2px 0', color: 'var(--red)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {s.firstName} {s.lastName} ({s.chargeHeures}h)
              </button>
            ))}
          </div>
        ) : <div>{tStaff('affectations.apCapNoSuggestion')}</div>}
      </div>
    )
  }

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={sScroll}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          {isAdmin ? tAdmin('affectations.title') : tStaff('affectations.title')}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>
          {isAdmin ? 'Associez chaque matière du programme à un enseignant pour chaque classe.' : tStaff('affectations.subtitle')}
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '9px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <WifiOff size={16} strokeWidth={2} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>Mode hors-ligne — les nouvelles affectations seront synchronisées à la reconnexion</span>
        </div>
      )}

      <div style={{ ...sCard, marginBottom: 16, maxWidth: 460 }}>
        <div style={sLabel}>Choisir une classe</div>
        {loadingClasses ? (
          <div style={{ color: 'var(--text3)', fontSize: 12.5 }}>Chargement…</div>
        ) : (
          <select style={sSelect} value={classId} onChange={e => handleClassChange(e.target.value)}>
            <option value="">— Sélectionner une classe —</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
            <Package size={12} strokeWidth={2} /> Données du {new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} — hors-ligne
          </div>
        )}
      </div>

      {classId && selectedClass && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8, marginBottom: 16 }}>
          <button type="button" onClick={() => void handleClearClass()} disabled={clearing} style={{ background: 'var(--red-light)', color: 'var(--red)', border: '1px solid var(--red-light)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: clearing ? 'wait' : 'pointer', opacity: clearing ? 0.6 : 1 }}>
            {clearing ? tStaff('affectations.clearing') : tStaff('affectations.clearClass')}
          </button>
        </div>
      )}

      {allowAutoGenerate && !classId && classes.length > 0 && (
        <GenerateAllBanner generatingAll={generatingAll} onGenerateAll={() => void handleGenerateAll()} />
      )}

      {meta && classId && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ background: meta.assigned === meta.total ? 'var(--green-light)' : 'var(--amber-light)', border: `1px solid ${meta.assigned === meta.total ? 'var(--green-light)' : 'var(--amber-light)'}`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            {meta.assigned === meta.total ? <CheckCircle2 size={18} strokeWidth={2} /> : <AlertTriangle size={18} strokeWidth={2} />}
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{meta.assigned}/{meta.total}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>matières affectées</div>
            </div>
          </div>
          {meta.assigned < meta.total && (
            <div style={{ background: 'var(--orange-light)', border: '1px solid var(--orange-light)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={18} strokeWidth={2} />
              <div style={{ fontSize: 12.5, color: 'var(--orange)' }}>
                <strong>{meta.total - meta.assigned}</strong> matière{meta.total - meta.assigned > 1 ? 's' : ''} sans enseignant
              </div>
            </div>
          )}
        </div>
      )}

      {allowAutoGenerate && classId && selectedClass && (
        <AssignmentGenerationPanel generating={generating} generationResult={generationResult} onGenerate={() => void handleGenerate()} />
      )}

      {classId && (
        <div style={sCard}>
          {loadingRows ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 13 }}>Chargement des matières…</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><BookOpen size={32} strokeWidth={1.75} /></div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                Aucune matière dans le programme de {selectedClass?.name}.<br />
                Configurez d&apos;abord les coefficients dans la section Matières.
              </div>
            </div>
          ) : (
            <>
              <div className="md:hidden flex flex-col gap-2.5">
                {rows.map(row => {
                  const isSaving = saving === row.subjectId
                  const unassigned = row.currentTeacherId === null
                  const sourceLabel = allowAutoGenerate && row.currentSource ? tStaff(`affectations.source.${row.currentSource}`) : null
                  return (
                    <div key={row.subjectId} style={{ borderRadius: 10, padding: 12, background: unassigned ? 'var(--amber-light)' : 'var(--bg2)', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>
                          {unassigned && <span style={{ marginRight: 5, display: 'inline-flex', verticalAlign: 'middle' }}><AlertTriangle size={13} /></span>}
                          {row.subjectName}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 700 }}>×{row.coefficient}</span>
                          {isSaving && <Loader2 size={14} className="animate-spin" />}
                          {!isSaving && !unassigned && <Check size={14} color="var(--green)" />}
                        </div>
                      </div>
                      <select
                        style={{ ...sSelect, marginTop: 8, opacity: isSaving ? 0.6 : 1, borderColor: unassigned ? 'var(--amber-light)' : 'var(--border)', background: unassigned ? 'var(--amber-light)' : 'var(--surface)' }}
                        value={row.currentTeacherId ?? ''}
                        disabled={isSaving}
                        onChange={e => void handleAssign(row.subjectId, e.target.value || null)}
                      >
                        <option value="">— Non assigné —</option>
                        {row.eligibleTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                        {row.currentTeacherId && !row.eligibleTeachers.find(t => t.id === row.currentTeacherId) && (
                          <option value={row.currentTeacherId}>{row.currentTeacherName ?? row.currentTeacherId}</option>
                        )}
                      </select>
                      {sourceLabel && !isSaving && <div style={{ marginTop: 3, fontSize: 10.5, color: 'var(--text3)' }}>{sourceLabel}</div>}
                      {row.eligibleTeachers.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>Aucun enseignant n&apos;a déclaré cette matière.</div>}
                      {renderAssignmentError(row.subjectId)}
                    </div>
                  )
                })}
              </div>

              <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Matière</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', width: 70 }}>Coeff.</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Enseignant affecté</th>
                      <th style={{ width: 32 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(row => {
                      const isSaving = saving === row.subjectId
                      const unassigned = row.currentTeacherId === null
                      const sourceLabel = allowAutoGenerate && row.currentSource ? tStaff(`affectations.source.${row.currentSource}`) : null
                      return (
                        <tr key={row.subjectId} style={{ borderBottom: '1px solid var(--bg2)', background: unassigned ? 'var(--amber-light)' : 'var(--surface)' }}>
                          <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                            {unassigned && <span style={{ marginRight: 5, display: 'inline-flex', verticalAlign: 'middle' }}><AlertTriangle size={13} strokeWidth={2} /></span>}
                            {row.subjectName}
                          </td>
                          <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12.5, color: 'var(--text2)', fontWeight: 700 }}>{row.coefficient}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <select
                              style={{ ...sSelect, maxWidth: 320, padding: '4px 8px', fontSize: 12, opacity: isSaving ? 0.6 : 1, borderColor: unassigned ? 'var(--amber-light)' : 'var(--border)', background: unassigned ? 'var(--amber-light)' : 'var(--surface)' }}
                              value={row.currentTeacherId ?? ''}
                              disabled={isSaving}
                              onChange={e => void handleAssign(row.subjectId, e.target.value || null)}
                            >
                              <option value="">— Non assigné —</option>
                              {row.eligibleTeachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                              {row.currentTeacherId && !row.eligibleTeachers.find(t => t.id === row.currentTeacherId) && (
                                <option value={row.currentTeacherId}>{row.currentTeacherName ?? row.currentTeacherId}</option>
                              )}
                            </select>
                            {sourceLabel && !isSaving && <div style={{ marginTop: 3, fontSize: 10.5, color: 'var(--text3)' }}>{sourceLabel}</div>}
                            {row.eligibleTeachers.length === 0 && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>Aucun enseignant n&apos;a déclaré cette matière.</div>}
                            {renderAssignmentError(row.subjectId)}
                          </td>
                          <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                            {isSaving && <Loader2 size={14} strokeWidth={2} className="animate-spin" />}
                            {!isSaving && !unassigned && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={14} strokeWidth={2} /></span>}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {!classId && !loadingClasses && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text3)' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center' }}><GraduationCap size={40} strokeWidth={1.75} /></div>
          <div style={{ fontSize: 14 }}>Sélectionnez une classe pour gérer ses affectations.</div>
        </div>
      )}
    </div>
  )
}

