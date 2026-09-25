'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { CheckCircle2, AlertTriangle, ClipboardList, BookOpen, Loader2, Check, GraduationCap, WifiOff, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'

interface ClassItem { id: string; name: string; level: string | null; academicYearId: string }
interface AssignmentRow {
  subjectId: string
  subjectName: string
  coefficient: number
  currentTeacherId: string | null
  currentTeacherName: string | null
  currentSource: 'MANUAL' | 'GENERATED' | 'UNKNOWN' | null
  eligibleTeachers: { id: string; name: string }[]
}

interface GenerationCandidate {
  teacherId: string
  chargeActuelleHeures: number
  capaciteHeures: number | null
  estAP: boolean
}

interface UnresolvedItem {
  classId: string
  className: string
  subjectName: string
  raison: string
  details?: {
    weeklyPeriods: number | null
    candidats: GenerationCandidate[]
  }
}

interface GenerationResult {
  createdCount: number
  rebalancedCount?: number
  nonResolus: UnresolvedItem[]
  horsPerimetre: { classId: string; className: string; subjectName: string }[]
}

const sScroll: React.CSSProperties = { height: '100%', overflowY: 'auto' }
const sCard: React.CSSProperties = { background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '14px 18px' }
const sLabel: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }
const sSelect: React.CSSProperties = { width: '100%', padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit', cursor: 'pointer' }

export default function SectionAffectations({ onToast }: { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const t = useT('staff')
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [classId, setClassId] = useState('')
  const [rows, setRows] = useState<AssignmentRow[]>([])
  const [meta, setMeta] = useState<{ total: number; assigned: number } | null>(null)
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null)
  const [assignmentError, setAssignmentError] = useState<{ subjectId: string; code: 'AP_WEEKLY_CAP_EXCEEDED' | 'TEACHER_WEEKLY_CAP_EXCEEDED'; currentLoad: number; candidateLoad: number; suggestions: { teacherId: string; firstName: string; lastName: string; chargeHeures: number }[] } | null>(null)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [saving, setSaving] = useState<string | null>(null) // subjectId en cours de sauvegarde
  const [clearing, setClearing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [generatingAll, setGeneratingAll] = useState(false)
  const { isOnline, addToQueue } = useSyncQueue()

  useEffect(() => {
    fetchApi('/api/v2/classes', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []
        setClasses(list.map((c: any) => ({ id: c.id, name: c.name, level: c.level, academicYearId: c.academicYearId })))
      })
      .catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  const loadAssignments = useCallback((cid: string) => {
    if (!cid) { setRows([]); setMeta(null); return }
    setLoadingRows(true)
    fetchApi(`/api/v2/teaching-assignments?classId=${cid}`, { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (d.success) { setRows(d.data); setMeta(d.meta) }
      })
      .catch(() => onToast('Erreur lors du chargement des affectations', 'error'))
      .finally(() => setLoadingRows(false))
  }, [onToast])

  const handleClassChange = (cid: string) => {
    setClassId(cid)
    loadAssignments(cid)
  }

  const applyAssignmentLocally = (subjectId: string, teacherId: string | null) => {
    setRows(prev => prev.map(r =>
      r.subjectId === subjectId
        ? {
            ...r,
             currentTeacherId: teacherId,
             currentTeacherName: teacherId
               ? (r.eligibleTeachers.find(t => t.id === teacherId)?.name ?? null)
               : null,
             currentSource: teacherId ? 'MANUAL' : null,
          }
        : r,
    ))
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
    if (!selectedClass || !window.confirm(t('affectations.clearClassConfirm', { className: selectedClass.name }))) return
    setClearing(true)
    try {
      const res = await fetchApi('/api/v2/teaching-assignments/clear-class', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('affectations.clearClassError'))
      onToast(t('affectations.clearClassSuccess', { count: data.data.count }), 'success')
      loadAssignments(classId)
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('affectations.clearClassError'), 'error')
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
      onToast('Affectation mise en file d\'attente — synchronisation à la reconnexion', 'success')
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
      const d = await res.json()
      if (res.status === 409 && (d.error?.code === 'AP_WEEKLY_CAP_EXCEEDED' || d.error?.code === 'TEACHER_WEEKLY_CAP_EXCEEDED')) {
        setAssignmentError({
          subjectId,
          code: d.error.code,
          currentLoad: d.error.currentLoad,
          candidateLoad: d.error.candidateLoad,
          suggestions: d.error.suggestions ?? [],
        })
        onToast(t(d.error.code === 'TEACHER_WEEKLY_CAP_EXCEEDED' ? 'affectations.weeklyCapExceeded' : 'affectations.apCapExceeded'), 'error')
        return
      }
      if (!res.ok) throw new Error(d.message || 'Erreur')

      applyAssignmentLocally(subjectId, teacherId)
      onToast(teacherId ? 'Affectation enregistrée' : 'Affectation supprimée', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setSaving(null)
    }
  }

  const handleGenerateAll = async () => {
    const academicYearId = classes[0]?.academicYearId
    if (!academicYearId || !window.confirm(t('affectations.generateAllConfirm'))) return
    setGeneratingAll(true)
    try {
      const res = await fetchApi('/api/v2/teaching-assignments/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academicYearId, rebalanceExisting: false }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('affectations.generateError'))
      setGenerationResult(data.data)
      onToast(t('affectations.generateAllSuccess', { count: data.data.createdCount }), 'success')
    } catch (error) {
      onToast(error instanceof Error ? error.message : t('affectations.generateError'), 'error')
    } finally {
      setGeneratingAll(false)
    }
  }

  const handleGenerate = async () => {
    if (!classId || !selectedClass) return
    if (!window.confirm(t('affectations.generateConfirmNoRebalance'))) return
    setGenerating(true)
    setGenerationResult(null)
    try {
      const res = await fetchApi('/api/v2/teaching-assignments/generate', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ classId, academicYearId: selectedClass.academicYearId, rebalanceExisting: false }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || 'Erreur')
      setGenerationResult(d.data)
      loadAssignments(classId)
      onToast(t('affectations.generateSuccess', { count: d.data.createdCount }), 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : t('affectations.generateError'), 'error')
    } finally {
      setGenerating(false)
    }
  }

  const selectedClass = classes.find(c => c.id === classId)

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={sScroll}>
      {/* En-tête */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
          {t('affectations.title')}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>
          {t('affectations.subtitle')}
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '9px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={16} strokeWidth={2} /></span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>Mode hors-ligne — les nouvelles affectations seront synchronisées à la reconnexion</span>
        </div>
      )}

      {/* Sélecteur de classe */}
      <div style={{ ...sCard, marginBottom: 16, maxWidth: 440 }}>
        <div style={sLabel}>Choisir une classe</div>
        {loadingClasses ? (
          <div style={{ color: 'var(--text3)', fontSize: 12.5 }}>Chargement…</div>
        ) : (
          <select style={sSelect} value={classId} onChange={e => handleClassChange(e.target.value)}>
            <option value="">— Sélectionner une classe —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>
      {classId && selectedClass && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8, marginBottom: 16 }}>
          <button type="button" onClick={handleClearClass} disabled={clearing} style={{ background: 'var(--red-light)', color: 'var(--red)', border: '1px solid var(--red-light)', borderRadius: 8, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: clearing ? 'wait' : 'pointer', opacity: clearing ? 0.6 : 1 }}>
            {clearing ? t('affectations.clearing') : t('affectations.clearClass')}
          </button>
        </div>
      )}

      {!classId && classes.length > 0 && (
        <div style={{ ...sCard, marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('affectations.generateAllTitle')}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('affectations.generateAllHint')}</div>
          </div>
          <button type="button" onClick={handleGenerateAll} disabled={generatingAll} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-bold disabled:opacity-50">
            {generatingAll ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {generatingAll ? t('affectations.generatingAll') : t('affectations.generateAllButton')}
          </button>
        </div>
      )}

      {/* KPI */}
      {meta && classId && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ background: meta.assigned === meta.total ? 'var(--green-light)' : 'var(--amber-light)', border: `1px solid ${meta.assigned === meta.total ? 'var(--green-light)' : 'var(--amber-light)'}`, borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-flex' }}>{meta.assigned === meta.total ? <CheckCircle2 size={18} strokeWidth={2} /> : <AlertTriangle size={18} strokeWidth={2} />}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{meta.assigned}/{meta.total}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>matières affectées</div>
            </div>
          </div>
          {meta.assigned < meta.total && (
            <div style={{ background: 'var(--orange-light)', border: '1px solid var(--orange-light)', borderRadius: 10, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ display: 'inline-flex' }}><ClipboardList size={18} strokeWidth={2} /></span>
              <div style={{ fontSize: 12.5, color: 'var(--orange)' }}>
                <strong>{meta.total - meta.assigned}</strong> matière{meta.total - meta.assigned > 1 ? 's' : ''} sans enseignant
              </div>
            </div>
          )}
        </div>
      )}

      {/* Génération automatique */}
      {classId && selectedClass && (
        <div style={{ ...sCard, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('affectations.generateTitle')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('affectations.generateHint')}</div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-white text-xs font-bold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity shadow-btn-primary"
            >
              {generating ? <Loader2 size={15} strokeWidth={2} className="animate-spin" /> : <Sparkles size={15} strokeWidth={2} />}
              {t('affectations.generateButton')}
            </button>
          </div>

          {generationResult && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 10 }}>
                 <div style={{ fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>
                   {t('affectations.generatedCreated', { count: generationResult.createdCount })}
                 </div>
                 {generationResult.rebalancedCount !== undefined && generationResult.rebalancedCount > 0 && (
                   <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 700 }}>
                     {t('affectations.generatedRebalanced', { count: generationResult.rebalancedCount })}
                   </div>
                 )}
                {generationResult.nonResolus.length > 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--orange)', fontWeight: 700 }}>
                    {t('affectations.generatedUnresolved', { count: generationResult.nonResolus.length })}
                  </div>
                )}
                {generationResult.horsPerimetre.length > 0 && (
                  <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 700 }}>
                    {t('affectations.generatedOutOfScope', { count: generationResult.horsPerimetre.length })}
                  </div>
                )}
              </div>

              {generationResult.nonResolus.length > 0 && (
                <details style={{ marginBottom: 8 }}>
                  <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--orange)', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ChevronDown size={14} /> {t('affectations.unresolvedTitle')}
                  </summary>
                  <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12, color: 'var(--text2)' }}>
                    {generationResult.nonResolus.map((item, idx) => (
                       <li key={idx} style={{ marginBottom: 6 }}>
                         <div>
                           {item.className} — {item.subjectName} : {t(`affectations.reason.${item.raison}`)}
                         </div>
                         {item.details && item.details.candidats.length > 0 && (
                           <div style={{ marginTop: 3, color: 'var(--text3)', fontSize: 11 }}>
                             {item.details.candidats.map((candidate) => (
                               <div key={candidate.teacherId}>
                                 {t('affectations.candidateLoad', {
                                   teacher: candidate.teacherId,
                                   load: candidate.chargeActuelleHeures,
                                   capacity: candidate.capaciteHeures ?? t('affectations.capacityUnconfigured'),
                                   ap: candidate.estAP ? t('affectations.apBadge') : '',
                                 })}
                               </div>
                             ))}
                           </div>
                         )}
                       </li>
                    ))}
                  </ul>
                </details>
              )}

              {generationResult.horsPerimetre.length > 0 && (
                <details>
                  <summary style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ChevronDown size={14} /> {t('affectations.outOfScopeTitle')}
                  </summary>
                  <ul style={{ margin: '6px 0 0 18px', padding: 0, fontSize: 12, color: 'var(--text2)' }}>
                    {generationResult.horsPerimetre.map((item, idx) => (
                      <li key={idx} style={{ marginBottom: 3 }}>
                        {item.className} — {item.subjectName}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tableau */}
      {classId && (
        <div style={sCard}>
          {loadingRows ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text3)', fontSize: 13 }}>Chargement des matières…</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><BookOpen size={32} strokeWidth={1.75} /></div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                Aucune matière dans le programme de {selectedClass?.name}.<br />
                Configurez d'abord les coefficients dans la section Matières.
              </div>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
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
                         const sourceLabel = row.currentSource ? t(`affectations.source.${row.currentSource}`) : null
                    return (
                      <tr key={row.subjectId} style={{ borderBottom: '1px solid var(--bg2)', background: unassigned ? 'var(--amber-light)' : 'var(--surface)' }}>
                        <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                          {unassigned && <span style={{ marginRight: 5, display: 'inline-flex' }}><AlertTriangle size={13} strokeWidth={2} /></span>}
                          {row.subjectName}
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'center', fontSize: 12.5, color: 'var(--text2)', fontWeight: 700 }}>
                          {row.coefficient}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <select
                            style={{
                              ...sSelect,
                              maxWidth: 320,
                              padding: '4px 8px',
                              fontSize: 12,
                              opacity: isSaving ? 0.6 : 1,
                              borderColor: unassigned ? 'var(--amber-light)' : 'var(--border)',
                              background: unassigned ? 'var(--amber-light)' : 'var(--surface)',
                            }}
                            value={row.currentTeacherId ?? ''}
                            disabled={isSaving}
                            onChange={e => handleAssign(row.subjectId, e.target.value || null)}
                          >
                            <option value="">— Non assigné —</option>
                            {row.eligibleTeachers.map(t => (
                              <option key={t.id} value={t.id}>{t.name}</option>
                            ))}
                            {/* Enseignant actuellement affecté mais pas éligible (sécurité) */}
                            {row.currentTeacherId && !row.eligibleTeachers.find(t => t.id === row.currentTeacherId) && (
                              <option value={row.currentTeacherId}>{row.currentTeacherName ?? row.currentTeacherId}</option>
                            )}
                           </select>
                           {sourceLabel && !isSaving && (
                             <div style={{ marginTop: 3, fontSize: 10.5, color: 'var(--text3)' }}>
                               {sourceLabel}
                             </div>
                           )}
                           {row.eligibleTeachers.length === 0 && (
                            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>
                              Aucun enseignant n'a déclaré cette matière.
                            </div>
                          )}
                          {assignmentError?.subjectId === row.subjectId && (
                            <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'var(--red-light)', border: '1px solid var(--red-light)', fontSize: 11.5, color: 'var(--red)' }}>
                               <div style={{ fontWeight: 700, marginBottom: 4 }}>
                                 {t(assignmentError.code === 'TEACHER_WEEKLY_CAP_EXCEEDED' ? 'affectations.weeklyCapExceeded' : 'affectations.apCapExceeded', { current: assignmentError.currentLoad, candidate: assignmentError.candidateLoad })}
                               </div>
                              {assignmentError.suggestions.length > 0 && (
                                <div>
                                  <div style={{ marginBottom: 2 }}>{t('affectations.apCapSuggestions')} :</div>
                                  {assignmentError.suggestions.map((s) => (
                                    <button
                                      key={s.teacherId}
                                      type="button"
                                      onClick={() => handleAssign(row.subjectId, s.teacherId)}
                                      style={{ display: 'block', textAlign: 'left', background: 'transparent', border: 'none', padding: '2px 0', color: 'var(--red)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                                    >
                                      {s.firstName} {s.lastName} ({s.chargeHeures}h)
                                    </button>
                                  ))}
                                </div>
                              )}
                              {assignmentError.suggestions.length === 0 && (
                                <div>{t('affectations.apCapNoSuggestion')}</div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                          {isSaving && <span style={{ display: 'inline-flex' }}><Loader2 size={14} strokeWidth={2} className="animate-spin" /></span>}
                          {!isSaving && !unassigned && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={14} strokeWidth={2} /></span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
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
