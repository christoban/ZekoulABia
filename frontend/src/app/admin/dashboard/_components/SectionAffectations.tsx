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

const sScroll: React.CSSProperties = { height: '100%', overflowY: 'auto', padding: '12px 14px' }
const sCardCls = 'rounded-[10px] md:rounded-[10px] p-3 md:px-5 md:py-4 shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]'
const sCard: React.CSSProperties = { background: 'var(--surface)' }
const sLabel: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }
const sSelect: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid var(--border)', fontSize: 13, color: 'var(--text)', background: 'var(--surface)', fontFamily: 'inherit', cursor: 'pointer' }

export default function SectionAffectations({ onToast }: { onToast: (msg: string, type?: 'success' | 'error' | 'info') => void }) {
  const t = useT('admin')
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [classId, setClassId] = useState('')
  const [rows, setRows] = useState<AssignmentRow[]>([])
  const [meta, setMeta] = useState<{ total: number; assigned: number } | null>(null)
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingRows, setLoadingRows] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
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

  const handleAssign = async (subjectId: string, teacherId: string | null) => {
    const payload = { classId, subjectId, teacherId }

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
      if (!res.ok) throw new Error(d.message || 'Erreur')

      applyAssignmentLocally(subjectId, teacherId)
      onToast(teacherId ? 'Affectation enregistrée' : 'Affectation supprimée', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setSaving(null)
    }
  }

  const selectedClass = classes.find(c => c.id === classId)

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ ...sScroll, padding: undefined }}>
      <div style={{ marginBottom: 10 }}>
        <div className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          {t('affectations.title')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Associez chaque matière du programme à un enseignant pour chaque classe.
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1.5px solid var(--amber)', borderRadius: 8, padding: '10px 12px', marginBottom: 13, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={15} strokeWidth={2} /></span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>Mode hors-ligne — les nouvelles affectations seront synchronisées à la reconnexion</span>
        </div>
      )}

      <div className={sCardCls} style={{ ...sCard, marginBottom: 11, maxWidth: 480 }}>
        <div style={sLabel}>Choisir une classe</div>
        {loadingClasses ? (
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>Chargement…</div>
        ) : (
          <select style={sSelect} value={classId} onChange={e => handleClassChange(e.target.value)}>
            <option value="">— Sélectionner une classe —</option>
            {classes.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        )}
      </div>

      {meta && classId && (
        <div style={{ display: 'flex', gap: 11, flexWrap: 'wrap', marginBottom: 11 }}>
          <div className="rounded-[8px] px-3.5 py-2.5 md:px-4 md:py-2.5" style={{ background: meta.assigned === meta.total ? 'var(--green-light)' : 'var(--amber-light)', border: `1.5px solid ${meta.assigned === meta.total ? 'var(--green-light)' : 'var(--amber-light)'}`, display: 'flex', alignItems: 'center', gap: 8 }}>
            {meta.assigned === meta.total ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
            <div>
              <div className="text-[18px] md:text-[18px]" style={{ fontWeight: 800, color: 'var(--text)' }}>{meta.assigned}/{meta.total}</div>
              <div className="text-[12px] md:text-[12px]" style={{ color: 'var(--text2)' }}>matières affectées</div>
            </div>
          </div>
          {meta.assigned < meta.total && (
            <div className="rounded-[8px] px-3.5 py-2.5 md:px-4 md:py-2.5" style={{ background: 'var(--orange-light)', border: '1.5px solid var(--orange-light)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <ClipboardList size={15} />
              <div className="text-[12px] md:text-[12px]" style={{ color: 'var(--orange)' }}>
                <strong>{meta.total - meta.assigned}</strong> matière{meta.total - meta.assigned > 1 ? 's' : ''} sans enseignant
              </div>
            </div>
          )}
        </div>
      )}

      {classId && (
        <div className={sCardCls} style={sCard}>
          {loadingRows ? (
            <div style={{ textAlign: 'center', padding: '18px', color: 'var(--text3)' }}>Chargement des matières…</div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '18px' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><BookOpen size={16} /></div>
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                Aucune matière dans le programme de {selectedClass?.name}.<br />
                Configurez d'abord les coefficients dans la section Matières.
              </div>
            </div>
          ) : (
            <>
            <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
              {rows.map(row => {
                const isSaving = saving === row.subjectId
                const unassigned = row.currentTeacherId === null
                return (
                  <div key={row.subjectId} style={{ borderRadius: 8, padding: 14, background: unassigned ? 'var(--amber-light)' : 'var(--bg2)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
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
                  </div>
                )
              })}
            </div>

            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '10px 11px', fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Matière</th>
                    <th style={{ textAlign: 'center', padding: '10px 11px', fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em', width: 28 }}>Coeff.</th>
                    <th style={{ textAlign: 'left', padding: '10px 11px', fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Enseignant affecté</th>
                    <th style={{ width: 28 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(row => {
                    const isSaving = saving === row.subjectId
                    const unassigned = row.currentTeacherId === null
                    return (
                      <tr key={row.subjectId} style={{ borderBottom: '1px solid var(--bg2)', background: unassigned ? 'var(--amber-light)' : 'white' }}>
                        <td style={{ padding: '12px 11px', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                          {unassigned && <span style={{ marginRight: 6, display: 'inline-flex', verticalAlign: 'middle' }}><AlertTriangle size={14} /></span>}
                          {row.subjectName}
                        </td>
                        <td style={{ padding: '12px 11px', textAlign: 'center', fontSize: 13, color: 'var(--text2)', fontWeight: 700 }}>
                          {row.coefficient}
                        </td>
                        <td style={{ padding: '12px 11px' }}>
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
                            {row.currentTeacherId && !row.eligibleTeachers.find(t => t.id === row.currentTeacherId) && (
                              <option value={row.currentTeacherId}>{row.currentTeacherName ?? row.currentTeacherId}</option>
                            )}
                          </select>
                          {row.eligibleTeachers.length === 0 && (
                            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                              Aucun enseignant n'a déclaré cette matière.
                            </div>
                          )}
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
        <div style={{ textAlign: 'center', padding: '25px', color: 'var(--text3)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><GraduationCap size={16} /></div>
          <div style={{ fontSize: 13 }}>Sélectionnez une classe pour gérer ses affectations.</div>
        </div>
      )}
    </div>
  )
}
