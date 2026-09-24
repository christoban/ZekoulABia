'use client'

import { useState, useEffect, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, ClipboardList, BookOpen, Loader2, Check, GraduationCap, WifiOff } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'

interface ClassItem { id: string; name: string; level: string | null }
interface AssignmentRow {
  subjectId: string
  subjectName: string
  coefficient: number
  currentTeacherId: string | null
  currentTeacherName: string | null
  eligibleTeachers: { id: string; name: string }[]
}

interface AssignmentError {
  subjectId: string
  currentLoad: number
  candidateLoad: number
  suggestions: { teacherId: string; firstName: string; lastName: string; chargeHeures: number }[]
}

const sScroll: React.CSSProperties = { height: '100%', overflowY: 'auto', padding: '32px 40px' }
const sCardCls = 'rounded-[16px] md:rounded-[16px] p-[16px] md:px-[32px] md:py-[28px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]'
const sCard: React.CSSProperties = { background: 'var(--surface)' }
const sLabel: React.CSSProperties = { fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }
const sSelect: React.CSSProperties = { width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid var(--border)', fontSize: 15, color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit', cursor: 'pointer' }

export default function SectionAffectations({ onToast }: { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const t = useT('admin')
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [classId, setClassId] = useState('')
  const [rows, setRows] = useState<AssignmentRow[]>([])
  const [meta, setMeta] = useState<{ total: number; assigned: number } | null>(null)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [saving, setSaving] = useState<string | null>(null) // subjectId en cours de sauvegarde
  const [clearing, setClearing] = useState(false)
  const [assignmentError, setAssignmentError] = useState<AssignmentError | null>(null)
  const { isOnline, addToQueue } = useSyncQueue()

  useEffect(() => {
    fetchApi('/api/v2/classes')
      .then(r => r.json())
      .then(d => {
        if (d.success) setClasses(d.data.map((c: any) => ({ id: c.id, name: c.name, level: c.level })))
      })
      .catch(() => {})
      .finally(() => setLoadingClasses(false))
  }, [])

  const loadAssignments = useCallback((cid: string) => {
    if (!cid) { setRows([]); setMeta(null); return }
    setLoadingRows(true)
    fetchApi(`/api/v2/teaching-assignments?classId=${cid}`)
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const d = await res.json()
      if (res.status === 409 && d.error?.code === 'AP_WEEKLY_CAP_EXCEEDED') {
        setAssignmentError({
          subjectId,
          currentLoad: d.error.currentLoad,
          candidateLoad: d.error.candidateLoad,
          suggestions: d.error.suggestions ?? [],
        })
        onToast(t('affectations.apCapExceeded'), 'error')
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

  const renderAssignmentError = (subjectId: string) => {
    if (assignmentError?.subjectId !== subjectId) return null
    return (
      <div style={{ marginTop: 8, padding: 8, borderRadius: 8, background: 'var(--red-light)', border: '1px solid var(--red-light)', fontSize: 11.5, color: 'var(--red)' }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>
          {t('affectations.apCapExceeded', { current: assignmentError.currentLoad, candidate: assignmentError.candidateLoad })}
        </div>
        {assignmentError.suggestions.length > 0 ? (
          <div>
            <div style={{ marginBottom: 2 }}>{t('affectations.apCapSuggestions')} :</div>
            {assignmentError.suggestions.map(suggestion => (
              <button
                key={suggestion.teacherId}
                type="button"
                onClick={() => handleAssign(subjectId, suggestion.teacherId)}
                style={{ display: 'block', textAlign: 'left', background: 'transparent', border: 'none', padding: '2px 0', color: 'var(--red)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
              >
                {suggestion.firstName} {suggestion.lastName} ({suggestion.chargeHeures}h)
              </button>
            ))}
          </div>
        ) : <div>{t('affectations.apCapNoSuggestion')}</div>}
      </div>
    )
  }

  const selectedClass = classes.find(c => c.id === classId)

  return (
    <div className="px-4 py-5 md:px-10 md:py-8" style={{ ...sScroll, padding: undefined }}>
      {/* En-tête */}
      <div style={{ marginBottom: 28 }}>
        <div className="text-[15px] md:text-[17px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          {t('affectations.title')}
        </div>
        <div className="text-[11px] md:text-[12px]" style={{ color: 'var(--text3)' }}>
          Associez chaque matière du programme à un enseignant pour chaque classe.
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 12, padding: '12px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={18} strokeWidth={2} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--amber)' }}>Mode hors-ligne — les nouvelles affectations seront synchronisées à la reconnexion</span>
        </div>
      )}

      {/* Sélecteur de classe */}
      <div className={sCardCls} style={{ ...sCard, marginBottom: 24, maxWidth: 480 }}>
        <div style={sLabel}>Choisir une classe</div>
        {loadingClasses ? (
          <div style={{ color: 'var(--text3)', fontSize: 14 }}>Chargement…</div>
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
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -12, marginBottom: 24 }}>
          <button type="button" onClick={handleClearClass} disabled={clearing} style={{ background: 'var(--red-light)', color: 'var(--red)', border: '1px solid var(--red-light)', borderRadius: 8, padding: '8px 13px', fontSize: 12, fontWeight: 700, cursor: clearing ? 'wait' : 'pointer', opacity: clearing ? 0.6 : 1 }}>
            {clearing ? t('affectations.clearing') : t('affectations.clearClass')}
          </button>
        </div>
      )}

      {/* KPI */}
      {meta && classId && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
          <div className="rounded-[12px] px-[16px] py-[12px] md:px-[22px] md:py-[14px]" style={{ background: meta.assigned === meta.total ? 'var(--green-light)' : 'var(--amber-light)', border: `1.5px solid ${meta.assigned === meta.total ? 'var(--green-light)' : 'var(--amber-light)'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
            {meta.assigned === meta.total ? <CheckCircle2 size={24} /> : <AlertTriangle size={24} />}
            <div>
              <div className="text-[18px] md:text-[22px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{meta.assigned}/{meta.total}</div>
              <div className="text-[12px] md:text-[13px]" style={{ color: 'var(--text2)' }}>matières affectées</div>
            </div>
          </div>
          {meta.assigned < meta.total && (
            <div className="rounded-[12px] px-[16px] py-[12px] md:px-[22px] md:py-[14px]" style={{ background: 'var(--orange-light)', border: '1.5px solid var(--orange-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <ClipboardList size={20} />
              <div className="text-[13px] md:text-[14px]" style={{ color: 'var(--orange)' }}>
                <strong>{meta.total - meta.assigned}</strong> matière{meta.total - meta.assigned > 1 ? 's' : ''} sans enseignant
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tableau */}
      {classId && (
        <div className={sCardCls} style={sCard}>
          {loadingRows ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text3)' }}>Chargement des matières…</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><BookOpen size={40} /></div>
              <div style={{ fontSize: 16, color: 'var(--text3)' }}>
                Aucune matière dans le programme de {selectedClass?.name}.<br />
                Configurez d'abord les coefficients dans la section Matières.
              </div>
            </div>
          ) : (
            <>
            {/* ── Cartes empilées — mobile ── */}
            <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
              {rows.map(row => {
                const isSaving = saving === row.subjectId
                const unassigned = row.currentTeacherId === null
                return (
                  <div key={row.subjectId} style={{ borderRadius: 12, padding: 14, background: unassigned ? 'var(--amber-light)' : 'var(--bg2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>
                        {unassigned && <span style={{ marginRight: 6, display: 'inline-flex', verticalAlign: 'middle' }}><AlertTriangle size={14} /></span>}
                        {row.subjectName}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 700 }}>×{row.coefficient}</span>
                        {isSaving && <Loader2 size={16} className="animate-spin" />}
                        {!isSaving && !unassigned && <Check size={16} color="var(--green)" />}
                      </div>
                    </div>
                    <select
                      style={{
                        ...sSelect,
                        marginTop: 8,
                        opacity: isSaving ? 0.6 : 1,
                        borderColor: unassigned ? 'var(--amber-light)' : 'var(--border)',
                        background: unassigned ? 'var(--amber-light)' : 'white',
                      }}
                      value={row.currentTeacherId ?? ''}
                      disabled={isSaving}
                      onChange={e => handleAssign(row.subjectId, e.target.value || null)}
                    >
                      <option value="">— Non assigné —</option>
                      {row.eligibleTeachers.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                      {row.currentTeacherId && !row.eligibleTeachers.find(t => t.id === row.currentTeacherId) && (
                        <option value={row.currentTeacherId}>{row.currentTeacherName ?? row.currentTeacherId}</option>
                      )}
                    </select>
                     {row.eligibleTeachers.length === 0 && (
                       <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                         Aucun enseignant n'a déclaré cette matière.
                       </div>
                     )}
                     {renderAssignmentError(row.subjectId)}
                   </div>
                )
              })}
            </div>

            {/* ── Tableau — desktop ── */}
            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Matière</th>
                    <th style={{ textAlign: 'center', padding: '10px 14px', fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', width: 80 }}>Coeff.</th>
                    <th style={{ textAlign: 'left', padding: '10px 14px', fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Enseignant affecté</th>
                    <th style={{ width: 36 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const isSaving = saving === row.subjectId
                    const unassigned = row.currentTeacherId === null
                    return (
                      <tr key={row.subjectId} style={{ borderBottom: '1px solid var(--bg2)', background: unassigned ? 'var(--amber-light)' : 'white' }}>
                        <td style={{ padding: '12px 14px', fontSize: 15, fontWeight: 600, color: 'var(--text)' }}>
                          {unassigned && <span style={{ marginRight: 6, display: 'inline-flex', verticalAlign: 'middle' }}><AlertTriangle size={14} /></span>}
                          {row.subjectName}
                        </td>
                        <td style={{ padding: '12px 14px', textAlign: 'center', fontSize: 15, color: 'var(--text2)', fontWeight: 700 }}>
                          {row.coefficient}
                        </td>
                        <td style={{ padding: '12px 14px' }}>
                          <select
                            style={{
                              ...sSelect,
                              maxWidth: 340,
                              opacity: isSaving ? 0.6 : 1,
                              borderColor: unassigned ? 'var(--amber-light)' : 'var(--border)',
                              background: unassigned ? 'var(--amber-light)' : 'white',
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
                           {row.eligibleTeachers.length === 0 && (
                             <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                               Aucun enseignant n'a déclaré cette matière.
                             </div>
                           )}
                           {renderAssignmentError(row.subjectId)}
                         </td>
                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                          {isSaving && <Loader2 size={16} className="animate-spin" />}
                          {!isSaving && !unassigned && <Check size={16} color="var(--green)" />}
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
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><GraduationCap size={48} /></div>
          <div style={{ fontSize: 17 }}>Sélectionnez une classe pour gérer ses affectations.</div>
        </div>
      )}
    </div>
  )
}
