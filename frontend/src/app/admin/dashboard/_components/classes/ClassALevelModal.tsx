'use client'
import { useState, useEffect } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { ALEVEL_MIN, ALEVEL_MAX } from '@/features/classes/classesShared'
import {
  btnPrim,
  btnSec2,
  btnSecSm,
  sError,
  sInput,
  sInputCls,
  sModalTitle,
  sModalTitleCls,
  type ClassTarget,
  type SubjectItem,
  type ToastFn,
} from './classesUi'

interface ALevelStudentRow {
  id: string
  firstName: string
  lastName: string
  subjects: SubjectItem[]
  count: number
  saving: boolean
}

interface ALevelCombo {
  code: string
  type: string
  label: string
  subjects: string[]
}

interface RawALevelStudent {
  id: string
  firstName: string
  lastName: string
  subjects?: SubjectItem[]
  count?: number
}

interface Props {
  target: ClassTarget
  onClose: () => void
  onToast: ToastFn
}

export default function ClassALevelModal({ target, onClose, onToast }: Props) {
  const t = useT('admin')
  const [rows, setRows] = useState<ALevelStudentRow[]>([])
  const [available, setAvailable] = useState<SubjectItem[]>([])
  const [combos, setCombos] = useState<ALevelCombo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bulkCombo, setBulkCombo] = useState('')
  const [bulkApplying, setBulkApplying] = useState(false)
  const [editingStudentId, setEditingStudentId] = useState('')

  useEffect(() => {
    let active = true
    Promise.all([
      fetchApi(`/api/v2/classes/${target.id}/alevel-overview`, { credentials: 'include' }),
      fetchApi('/api/v2/onboarding/anglophone-streams', { credentials: 'include' }),
    ])
      .then(async ([ovRes, comboRes]) => {
        const [ov, comboData] = await Promise.all([ovRes.json(), comboRes.json()])
        if (!ovRes.ok) throw new Error(ov.message || t('classes.error.load'))
        const loadedCombos: ALevelCombo[] = comboData?.success
          ? [...(comboData.data.arts ?? []), ...(comboData.data.science ?? [])]
          : []
        const loadedRows: ALevelStudentRow[] = ((ov.data.students ?? []) as RawALevelStudent[]).map(s => ({
          id: s.id, firstName: s.firstName, lastName: s.lastName, subjects: s.subjects ?? [], count: s.count ?? 0, saving: false,
        }))
        if (active) {
          setRows(loadedRows)
          setAvailable(ov.data.availableSubjects ?? [])
          setCombos(loadedCombos)
          setLoading(false)
        }
      })
      .catch(err => {
        if (active) {
          setLoading(false)
          setError(err instanceof Error ? err.message : t('classes.error.load'))
        }
      })
    return () => { active = false }
  }, [target.id, t])

  const saveStudentALevel = async (studentId: string, subjects: SubjectItem[]) => {
    if (subjects.length > ALEVEL_MAX) return
    setRows(prev => prev.map(r => r.id === studentId ? { ...r, saving: true } : r))
    try {
      const res = await fetchApi(`/api/v2/students/${studentId}/alevel-subjects`, {
        method: 'PUT', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subjectIds: subjects.map(s => s.id) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      setRows(prev => prev.map(r => r.id === studentId ? { ...r, subjects, count: subjects.length, saving: false } : r))
    } catch (err) {
      setRows(prev => prev.map(r => r.id === studentId ? { ...r, saving: false } : r))
      onToast(err instanceof Error ? err.message : t('classes.error.load'), 'error')
    }
  }

  const toggleStudentSubject = (row: ALevelStudentRow, subject: SubjectItem) => {
    const has = row.subjects.some(s => s.id === subject.id)
    if (!has && row.subjects.length >= ALEVEL_MAX) {
      onToast(t('classes.alevel.max_error').replace('{max}', String(ALEVEL_MAX)), 'error')
      return
    }
    const next = has ? row.subjects.filter(s => s.id !== subject.id) : [...row.subjects, subject]
    saveStudentALevel(row.id, next)
  }

  const applyComboToStudent = async (studentId: string, combinationCode: string) => {
    if (!combinationCode) return
    setRows(prev => prev.map(r => r.id === studentId ? { ...r, saving: true } : r))
    try {
      const res = await fetchApi(`/api/v2/students/${studentId}/alevel-subjects/from-combination`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ combinationCode }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      const applied: SubjectItem[] = ((data.data?.applied ?? []) as Array<{ id: string; name: string }>).map(a => ({ id: a.id, name: a.name }))
      setRows(prev => prev.map(r => r.id === studentId ? { ...r, subjects: applied, count: applied.length, saving: false } : r))
    } catch (err) {
      setRows(prev => prev.map(r => r.id === studentId ? { ...r, saving: false } : r))
      onToast(err instanceof Error ? err.message : t('classes.error.load'), 'error')
    }
  }

  const bulkApplyCombo = async () => {
    if (!bulkCombo) return
    setBulkApplying(true)
    try {
      const res = await fetchApi(`/api/v2/classes/${target.id}/alevel-subjects/bulk-from-combination`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ combinationCode: bulkCombo }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      onToast(t('classes.alevel.toast_bulk_done').replace('{count}', String(data.data?.modifies ?? 0)), 'success')
      setBulkApplying(false)
      setBulkCombo('')
      const ov = await (await fetchApi(`/api/v2/classes/${target.id}/alevel-overview`, { credentials: 'include' })).json()
      if (ov?.success) {
        setRows(((ov.data.students ?? []) as RawALevelStudent[]).map(s => ({
          id: s.id, firstName: s.firstName, lastName: s.lastName, subjects: s.subjects ?? [], count: s.count ?? 0, saving: false,
        })))
      }
    } catch (err) {
      setBulkApplying(false)
      onToast(err instanceof Error ? err.message : t('classes.error.load'), 'error')
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="px-5 py-5 md:px-7 md:py-7" style={{ background: 'var(--surface)', borderRadius: 18, width: 720, maxWidth: '96vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('classes.alevel.title').replace('{name}', target.name)}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14 }}>
          Chaque élève choisit entre {ALEVEL_MIN} et {ALEVEL_MAX} matières. Les combinaisons ne sont qu&apos;un point de départ personnalisable.
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--purple)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={sError}>{error}</div>
        ) : rows.length === 0 ? (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>{t('classes.lv2.no_students')}</div>
        ) : (
          <>
            <div style={{ background: 'var(--purple-light)', border: '1.5px solid var(--purple-light)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--purple)' }}>Combinaison de départ pour toute la classe :</span>
              <select value={bulkCombo} onChange={e => setBulkCombo(e.target.value)} className={sInputCls} style={{ ...sInput, marginBottom: 0, flex: 1, minWidth: 160, fontSize: 13 }}>
                <option value="">— Choisir —</option>
                {combos.map(c => <option key={c.code} value={c.code}>{c.code} — {c.label}</option>)}
              </select>
              <button
                style={{ ...btnPrim, background: 'var(--purple)', fontSize: 13, padding: '7px 16px', opacity: (!bulkCombo || bulkApplying) ? 0.6 : 1 }}
                onClick={bulkApplyCombo}
                disabled={!bulkCombo || bulkApplying}
              >
                {bulkApplying ? 'En cours…' : 'Appliquer à tous'}
              </button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, border: '1.5px solid var(--border)', borderRadius: 12 }}>
              {rows.map((row, i) => {
                const incomplete = row.count < ALEVEL_MIN
                const editing = editingStudentId === row.id
                return (
                  <div key={row.id} style={{ padding: '10px 14px', borderBottom: i < rows.length - 1 ? '1px solid var(--bg2)' : 'none', background: editing ? 'var(--purple-light)' : 'white' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', minWidth: 150 }}>{row.lastName} {row.firstName}</span>
                      <span style={{ background: incomplete ? 'var(--red-light)' : 'var(--purple-light)', color: incomplete ? 'var(--red)' : 'var(--purple)', padding: '2px 9px', borderRadius: 14, fontSize: 12, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {row.count}/{ALEVEL_MAX}{incomplete && <AlertTriangle size={11} />}
                      </span>
                      {row.saving && <div style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--purple)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                        {row.subjects.map(s => (
                          <span key={s.id} style={{ background: 'var(--purple-light)', color: 'var(--purple)', padding: '2px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700 }}>{s.name}</span>
                        ))}
                        {row.count === 0 && <span style={{ color: 'var(--red)', fontSize: 12, fontStyle: 'italic', fontWeight: 700 }}>Aucune matière</span>}
                      </div>
                      <select
                        value=""
                        disabled={row.saving}
                        onChange={e => { if (e.target.value) applyComboToStudent(row.id, e.target.value) }}
                        style={{ fontSize: 12, border: '1px solid var(--border2)', borderRadius: 7, padding: '3px 6px', color: 'var(--text2)', background: 'var(--surface)', cursor: 'pointer', maxWidth: 120 }}
                      >
                        <option value="">Préréglage…</option>
                        {combos.map(c => <option key={c.code} value={c.code}>{c.code}</option>)}
                      </select>
                      <button
                        style={{ ...btnSecSm, color: 'var(--purple)', borderColor: 'rgba(124,58,237,0.3)', padding: '5px 12px' }}
                        onClick={() => setEditingStudentId(editing ? '' : row.id)}
                      >
                        {editing ? t('classes.subgroups.btn_close') : t('classes.btn_edit')}
                      </button>
                    </div>

                    {editing && (
                      <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {available.map(subj => {
                          const selected = row.subjects.some(s => s.id === subj.id)
                          const blocked = !selected && row.count >= ALEVEL_MAX
                          return (
                            <button
                              key={subj.id}
                              disabled={row.saving || blocked}
                              onClick={() => toggleStudentSubject(row, subj)}
                              style={{
                                padding: '5px 11px', borderRadius: 16, fontSize: 12.5, fontWeight: 700, cursor: (row.saving || blocked) ? 'not-allowed' : 'pointer',
                                border: `1.5px solid ${selected ? 'var(--purple)' : 'var(--border)'}`, background: selected ? 'var(--purple)' : 'white',
                                color: selected ? 'white' : blocked ? 'var(--border2)' : 'var(--text2)', opacity: blocked ? 0.5 : 1,
                              }}
                            >
                              {selected && <Check size={11} style={{ verticalAlign: 'middle', marginRight: 3 }} />}{subj.name}
                            </button>
                          )
                        })}
                        {available.length === 0 && (
                          <span style={{ color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>Aucune matière A-Level disponible dans cet établissement.</span>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
              <AlertTriangle size={12} /> = sélection incomplète (moins de {ALEVEL_MIN} matières). Les modifications sont enregistrées automatiquement.
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <button style={btnSec2} onClick={onClose}>{t('classes.subgroups.btn_close')}</button>
        </div>
      </div>
    </div>
  )
}
