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
  type SchoolInfo,
  type ToastFn,
} from './classesUi'

interface PEBSStudentRow {
  id: string
  firstName: string
  lastName: string
  pebsFiliere: string | null
  saving: boolean
}

interface PEBSOverview {
  className: string
  pebsCount: number
  nonPEBSCount: number
  total: number
  eleves: { id: string; firstName: string; lastName: string; pebsFiliere: string | null }[]
}

interface Props {
  target: ClassTarget
  schoolInfo: SchoolInfo | null
  onClose: () => void
  onToast: ToastFn
}

export default function ClassPebsModal({ target, schoolInfo, onClose, onToast }: Props) {
  const t = useT('admin')
  const [rows, setRows] = useState<PEBSStudentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(() => new Set())
  const [bulkValue, setBulkValue] = useState('')
  const [bulkAssigning, setBulkAssigning] = useState(false)

  useEffect(() => {
    let active = true
    fetchApi(`/api/v2/classes/${target.id}/pebs-overview`, { credentials: 'include' })
      .then(async res => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || t('classes.error.load'))
        const overview: PEBSOverview = data.data
        const mappedRows: PEBSStudentRow[] = overview.eleves.map(s => ({
          id: s.id, firstName: s.firstName, lastName: s.lastName, pebsFiliere: s.pebsFiliere, saving: false,
        }))
        if (active) {
          setRows(mappedRows)
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

  const getPEBSOptions = () => {
    const opts: { value: string; label: string }[] = []
    if (schoolInfo?.hasPEBSFrancophone) opts.push({ value: 'FR_PEBS', label: t('classes.pebs.opt_fr') })
    if (schoolInfo?.hasPEBSAnglophone) opts.push({ value: 'EN_PEBS', label: t('classes.pebs.opt_en') })
    return opts
  }

  const updateStudentPEBS = async (studentId: string, pebsFiliere: string | null) => {
    setRows(prev => prev.map(r => r.id === studentId ? { ...r, saving: true } : r))
    try {
      const res = await fetchApi(`/api/v2/students/${studentId}/pebs`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pebsFiliere }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      setRows(prev => prev.map(r => r.id === studentId ? { ...r, pebsFiliere, saving: false } : r))
    } catch {
      setRows(prev => prev.map(r => r.id === studentId ? { ...r, saving: false } : r))
      onToast(t('classes.pebs.update_error'), 'error')
    }
  }

  const bulkAssignPEBS = async () => {
    if (bulkSelected.size === 0) return
    setBulkAssigning(true)
    const selectedSnapshot = bulkSelected
    try {
      const res = await fetchApi('/api/v2/students/pebs/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentUserIds: Array.from(selectedSnapshot), pebsFiliere: bulkValue || null }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('classes.error.load'))
      const assigned = bulkValue || null
      setRows(prev => prev.map(r => selectedSnapshot.has(r.id) ? { ...r, pebsFiliere: assigned } : r))
      setBulkAssigning(false)
      setBulkSelected(new Set())
      setBulkValue('')
      onToast(t('classes.pebs.toast_bulk_done').replace('{count}', String(data.data?.modifies ?? selectedSnapshot.size)), 'success')
    } catch (err) {
      setBulkAssigning(false)
      onToast(err instanceof Error ? err.message : t('classes.error.load'), 'error')
    }
  }

  const pebsCount = rows.filter(r => r.pebsFiliere !== null).length
  const nonCount = rows.filter(r => r.pebsFiliere === null).length
  const frCount = rows.filter(r => r.pebsFiliere === 'FR_PEBS').length
  const enCount = rows.filter(r => r.pebsFiliere === 'EN_PEBS').length

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="px-5 py-6 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 18, width: 680, maxWidth: '96vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className={sModalTitleCls} style={sModalTitle}>{t('classes.pebs.title').replace('{name}', target.name)}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text3)', lineHeight: 1 }}>×</button>
        </div>

        {!loading && rows.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {frCount > 0 && <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>{t('classes.pebs.count_fr').replace('{count}', String(frCount))}</span>}
            {enCount > 0 && <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>{t('classes.pebs.count_en').replace('{count}', String(enCount))}</span>}
            {pebsCount > 0 && <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>{t('classes.pebs.total_pebs').replace('{count}', String(pebsCount))}</span>}
            {nonCount > 0 && <span style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '4px 12px', borderRadius: 20, fontSize: 13, fontWeight: 800 }}>{t('classes.pebs.non_pebs').replace('{count}', String(nonCount))}</span>}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={sError}>{error}</div>
        ) : rows.length === 0 ? (
          <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '32px 0', fontStyle: 'italic' }}>{t('classes.pebs.no_students')}</div>
        ) : (
          <>
            {bulkSelected.size > 0 && (
              <div style={{ background: 'var(--green-light)', border: '1.5px solid var(--green-light)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{t('classes.pebs.bulk_selected').replace('{count}', String(bulkSelected.size))}</span>
                <select value={bulkValue} onChange={e => setBulkValue(e.target.value)} className={sInputCls} style={{ ...sInput, marginBottom: 0, flex: 1, minWidth: 140, fontSize: 13 }}>
                  <option value="">{t('classes.pebs.bulk_clear_option')}</option>
                  {getPEBSOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <button style={{ ...btnPrim, fontSize: 13, padding: '7px 16px', opacity: bulkAssigning ? 0.7 : 1 }} onClick={bulkAssignPEBS} disabled={bulkAssigning}>
                  {bulkAssigning ? t('classes.pebs.bulk_assigning') : t('classes.pebs.btn_bulk_assign')}
                </button>
                <button style={{ ...btnSec2, fontSize: 13, padding: '7px 14px' }} onClick={() => setBulkSelected(new Set())}>{t('classes.pebs.btn_deselect_all')}</button>
              </div>
            )}

            <div style={{ overflow: 'auto', flex: 1, border: '1.5px solid var(--border)', borderRadius: 12 }}>
              <div style={{ minWidth: 420 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 160px', gap: 10, padding: '8px 14px', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 800, color: 'var(--text3)', position: 'sticky', top: 0 }}>
                  <div>
                    <input
                      type="checkbox"
                      checked={rows.length > 0 && bulkSelected.size === rows.length}
                      onChange={e => setBulkSelected(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())}
                      style={{ accentColor: 'var(--green)', cursor: 'pointer' }}
                    />
                  </div>
                  <div>{t('classes.pebs.col_el')}</div>
                  <div>{t('classes.pebs.col_status')}</div>
                </div>

                {rows.map((row, i) => {
                  const pebsLabel = row.pebsFiliere === 'FR_PEBS' ? t('classes.pebs.status_fr') : row.pebsFiliere === 'EN_PEBS' ? t('classes.pebs.status_en') : null
                  return (
                    <div key={row.id} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 160px', gap: 10, padding: '8px 14px', alignItems: 'center', borderBottom: i < rows.length - 1 ? '1px solid var(--bg2)' : 'none', background: bulkSelected.has(row.id) ? 'var(--green-light)' : 'white' }}>
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
                          style={{ accentColor: 'var(--green)', cursor: 'pointer' }}
                        />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{row.lastName} {row.firstName}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {row.saving ? (
                          <div style={{ width: 16, height: 16, border: '2px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', flexShrink: 0 }} />
                        ) : pebsLabel ? (
                          <span style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '2px 9px', borderRadius: 14, fontSize: 12, fontWeight: 800, whiteSpace: 'nowrap' }}>{pebsLabel}</span>
                        ) : (
                          <span style={{ background: 'var(--bg2)', color: 'var(--text2)', padding: '2px 9px', borderRadius: 14, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{t('classes.filiere_labels.GENERAL')}</span>
                        )}
                        <select
                          value={row.pebsFiliere ?? ''}
                          disabled={row.saving}
                          onChange={e => updateStudentPEBS(row.id, e.target.value || null)}
                          style={{ fontSize: 12, border: '1px solid var(--border2)', borderRadius: 7, padding: '3px 6px', color: 'var(--text2)', background: 'var(--surface)', cursor: 'pointer', maxWidth: 110 }}
                        >
                          <option value="">— Aucun —</option>
                          {getPEBSOptions().map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
