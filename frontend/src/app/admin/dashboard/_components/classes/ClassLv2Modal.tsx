'use client'
import { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import {
  btnPrim,
  btnSec2,
  sError,
  sInput,
  sInputCls,
  sModalTitle,
  sModalTitleCls,
  type ClassTarget,
  type SubjectItem,
  type ToastFn,
} from './classesUi'

interface LV2StudentRow {
  id: string
  firstName: string
  lastName: string
  lv2SubjectId: string | null
  pendingId: string | null
  saving: boolean
}

interface LV2Overview {
  className: string
  groupes: { subjectId: string; langue: string; nombreEleves: number; eleves: { id: string; firstName: string; lastName: string }[] }[]
  sansLV2: { id: string; firstName: string; lastName: string }[]
  total: number
}

interface Props {
  target: ClassTarget
  onClose: () => void
  onToast: ToastFn
}

export default function ClassLv2Modal({ target, onClose, onToast }: Props) {
  const t = useT('admin')
  const [rows, setRows] = useState<LV2StudentRow[]>([])
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(() => new Set())
  const [bulkSubjectId, setBulkSubjectId] = useState('')
  const [bulkAssigning, setBulkAssigning] = useState(false)

  useEffect(() => {
    let active = true
    Promise.all([
      fetchApi(`/api/v2/classes/${target.id}/lv2-overview`, { credentials: 'include' }),
      fetchApi('/api/v2/subjects', { credentials: 'include' }),
    ])
      .then(async ([overviewRes, subjectsRes]) => {
        const [overviewData, subjectsData] = await Promise.all([overviewRes.json(), subjectsRes.json()])
        if (!overviewRes.ok) throw new Error(overviewData.message || t('classes.error.load'))
        const overview: LV2Overview = overviewData.data
        const sortedSubjects: SubjectItem[] = (subjectsData.data ?? []).sort((a: SubjectItem, b: SubjectItem) => a.name.localeCompare(b.name))

        const lv2Map = new Map<string, string>()
        for (const g of overview.groupes) {
          for (const e of g.eleves) lv2Map.set(e.id, g.subjectId)
        }
        const allStudents: { id: string; firstName: string; lastName: string }[] = [
          ...overview.groupes.flatMap(g => g.eleves),
          ...overview.sansLV2,
        ].sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName))

        const mappedRows: LV2StudentRow[] = allStudents.map(s => ({
          id: s.id, firstName: s.firstName, lastName: s.lastName,
          lv2SubjectId: lv2Map.get(s.id) ?? null, pendingId: null, saving: false,
        }))

        if (active) {
          setRows(mappedRows)
          setSubjects(sortedSubjects)
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

  const updateStudentLV2 = async (studentId: string, lv2SubjectId: string | null) => {
    setRows(prev => prev.map(r => r.id === studentId ? { ...r, pendingId: lv2SubjectId, saving: true } : r))
    try {
      const res = await fetchApi(`/api/v2/students/${studentId}/lv2`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lv2SubjectId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      setRows(prev => prev.map(r => r.id === studentId ? { ...r, lv2SubjectId, pendingId: null, saving: false } : r))
    } catch {
      setRows(prev => prev.map(r => r.id === studentId ? { ...r, pendingId: null, saving: false } : r))
      onToast(t('classes.lv2.update_error'), 'error')
    }
  }

  const bulkAssignLV2 = async () => {
    if (bulkSelected.size === 0 || !bulkSubjectId) return
    setBulkAssigning(true)
    const selectedSnapshot = bulkSelected
    try {
      const res = await fetchApi('/api/v2/students/lv2/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentUserIds: Array.from(selectedSnapshot), lv2SubjectId: bulkSubjectId || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      const assignedId = bulkSubjectId || null
      setRows(prev => prev.map(r => selectedSnapshot.has(r.id) ? { ...r, lv2SubjectId: assignedId } : r))
      setBulkAssigning(false)
      setBulkSelected(new Set())
      setBulkSubjectId('')
      onToast(t('classes.lv2.toast_bulk_done').replace('{count}', String(data.data?.modifies ?? selectedSnapshot.size)), 'success')
    } catch (err) {
      setBulkAssigning(false)
      onToast(err instanceof Error ? err.message : t('classes.error.load'), 'error')
    }
  }

  const counts = new Map<string, { name: string; count: number }>()
  for (const r of rows) {
    if (r.lv2SubjectId) {
      const sub = subjects.find(s => s.id === r.lv2SubjectId)
      const name = sub?.name ?? r.lv2SubjectId
      const prev = counts.get(r.lv2SubjectId)
      counts.set(r.lv2SubjectId, { name, count: (prev?.count ?? 0) + 1 })
    }
  }
  const sansCount = rows.filter(r => !r.lv2SubjectId).length

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="px-5 py-6 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 18, width: 680, maxWidth: '96vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('classes.lv2.title').replace('{name}', target.name)}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>

        {!loading && rows.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {Array.from(counts.values()).map(({ name, count }) => (
              <span key={name} style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>
                {name}: {count}
              </span>
            ))}
            {sansCount > 0 && (
              <span style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>
                {t('classes.lv2.unassigned').replace('{count}', String(sansCount))}
              </span>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={sError}>{error}</div>
        ) : rows.length === 0 ? (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>{t('classes.lv2.no_students')}</div>
        ) : (
          <>
            {bulkSelected.size > 0 && (
              <div style={{ background: 'var(--blue-light)', border: '1.5px solid var(--blue-light)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--blue)' }}>{t('classes.lv2.bulk_selected').replace('{count}', String(bulkSelected.size))}</span>
                <select
                  value={bulkSubjectId}
                  onChange={e => setBulkSubjectId(e.target.value)}
                  className={sInputCls}
                  style={{ ...sInput, marginBottom: 0, flex: 1, minWidth: 140, fontSize: 13 }}
                >
                  <option value="">{t('classes.lv2.bulk_clear_option')}</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button style={{ ...btnPrim, fontSize: 13, padding: '7px 16px', opacity: bulkAssigning ? 0.7 : 1 }} onClick={bulkAssignLV2} disabled={bulkAssigning}>
                  {bulkAssigning ? t('classes.lv2.bulk_assigning') : t('classes.lv2.btn_bulk_assign')}
                </button>
                <button style={{ ...btnSec2, fontSize: 13, padding: '7px 14px' }} onClick={() => setBulkSelected(new Set())}>
                  {t('classes.lv2.btn_deselect_all')}
                </button>
              </div>
            )}

            <div style={{ overflow: 'auto', flex: 1, border: '1.5px solid var(--border)', borderRadius: 12 }}>
              <div style={{ minWidth: 420 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 200px', gap: 10, padding: '8px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 800, color: 'var(--text3)', position: 'sticky', top: 0 }}>
                  <div>
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && bulkSelected.size === rows.length}
                      onChange={e => setBulkSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())}
                      style={{ accentColor: 'var(--blue)', cursor: 'pointer' }}
                    />
                  </div>
                  <div>{t('classes.lv2.col_el')}</div>
                  <div>{t('classes.lv2.col_lv2')}</div>
                </div>

                {rows.map((row, i) => {
                  const currentSub = subjects.find(s => s.id === row.lv2SubjectId)
                  return (
                    <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 200px', gap: 10, padding: '8px 14px', alignItems: 'center', borderBottom: i < rows.length - 1 ? '1px solid var(--bg2)' : 'none', background: bulkSelected.has(row.id) ? 'var(--blue-light)' : 'var(--surface)' }}>
                      <div>
                        <input
                          type="checkbox"
                          checked={bulkSelected.has(row.id)}
                          onChange={() => setBulkSelected(prev => {
                            const next = new Set(prev)
                            if (next.has(row.id)) next.delete(row.id)
                            else next.add(row.id)
                            return next
                          })}
                          style={{ accentColor: 'var(--blue)', cursor: 'pointer' }}
                        />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{row.lastName} {row.firstName}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {row.saving ? (
                          <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', flexShrink: 0 }} />
                        ) : currentSub ? (
                          <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '2px 9px', borderRadius: 14, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{currentSub.name}</span>
                        ) : (
                          <span style={{ color: 'var(--red)', fontSize: 12, fontWeight: 700, fontStyle: 'italic' }}>{t('classes.lv2.unassigned_label')}</span>
                        )}
                        <select
                          value={row.lv2SubjectId ?? ''}
                          disabled={row.saving}
                          onChange={e => updateStudentLV2(row.id, e.target.value || null)}
                          style={{ fontSize: 12, border: '1px solid var(--border2)', borderRadius: 7, padding: '3px 6px', color: 'var(--text2)', background: 'var(--surface)', cursor: 'pointer', maxWidth: 110 }}
                        >
                          <option value="">— Aucune —</option>
                          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button style={btnSec2} onClick={onClose}>{t('classes.subgroups.btn_close')}</button>
        </div>
      </div>
    </div>
  )
}
