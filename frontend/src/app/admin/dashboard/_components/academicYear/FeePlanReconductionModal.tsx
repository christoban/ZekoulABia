'use client'
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import type { FeePlanItem, ReconductionRow, YearToastFn } from './academicYearUi'

interface Props {
  targetYearId: string
  targetYearName: string
  sourceYearId: string | null
  onClose: () => void
  onToast: YearToastFn
}

export default function FeePlanReconductionModal({
  targetYearId,
  targetYearName,
  sourceYearId,
  onClose,
  onToast,
}: Props) {
  const t = useT('admin')
  const [rows, setRows] = useState<ReconductionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        let plans: FeePlanItem[] = []
        if (sourceYearId) {
          const res = await fetchApi(`/api/v2/finance/fee-plans?academicYearId=${sourceYearId}`, { credentials: 'include' })
          const data = await res.json()
          if (res.ok) plans = data.data ?? []
        }
        if (plans.length === 0) {
          const res = await fetchApi('/api/v2/finance/fee-plans', { credentials: 'include' })
          const data = await res.json()
          if (res.ok) plans = data.data ?? []
        }
        if (active) {
          setRows(plans.map(p => ({ ...p, include: true, editedAmount: String(p.amount) })))
          setLoading(false)
        }
      } catch {
        if (active) {
          setLoading(false)
          setError(t('academic_year.toast.err'))
        }
      }
    }
    load()
    return () => { active = false }
  }, [sourceYearId, t])

  const toggleRow = (id: string) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, include: !row.include } : row))
  }

  const setRowAmount = (id: string, amount: string) => {
    setRows(prev => prev.map(row => row.id === id ? { ...row, editedAmount: amount } : row))
  }

  const confirmReconduction = async () => {
    const included = rows.filter(row => row.include)
    if (included.length === 0) {
      onClose()
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetchApi('/api/v2/finance/fee-plans/copy-from-previous-year', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAcademicYearId: targetYearId,
          plans: included.map(row => ({
            name: row.name,
            amount: parseFloat(row.editedAmount),
            feeType: row.feeType,
            level: row.level ?? undefined,
            sectionId: row.sectionId ?? undefined,
            isRefundable: row.isRefundable,
            dueDate: row.dueDate ?? undefined,
            description: row.description ?? undefined,
          })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('academic_year.toast.err'))
      const { crees, erreurs } = data.data as { crees: number; erreurs: { name: string; message: string }[] }
      if (erreurs?.length > 0) {
        onToast(`${crees} plan(s) reconduit(s), ${erreurs.length} échec(s) : ${erreurs.map(e => e.name).join(', ')}`, crees > 0 ? 'info' : 'error')
      } else {
        onToast(`${crees} plan(s) de frais reconduit(s) pour ${targetYearName}`, 'success')
      }
      onClose()
    } catch (err) {
      setSubmitting(false)
      setError(err instanceof Error ? err.message : t('academic_year.toast.err'))
    }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="px-5 py-6 md:px-9 md:py-8" style={{ background: 'var(--surface)', borderRadius: 18, width: 640, maxWidth: '94vw', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        <div className="text-[18px] md:text-[22px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
          Reconduire les plans de frais ?
        </div>
        <div className="text-[13px] md:text-[14px]" style={{ color: 'var(--text3)', marginBottom: 18 }}>
          Vers <strong>{targetYearName}</strong> — décochez les plans à ne pas reconduire, ajustez les montants si besoin. Rien n&apos;est créé tant que vous n&apos;avez pas confirmé.
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}><Loader2 size={22} className="animate-spin" /></div>
        )}

        {!loading && rows.length === 0 && (
          <div style={{ padding: '20px 0', color: 'var(--text3)', fontSize: 14 }}>Aucun plan de frais existant à reconduire.</div>
        )}

        {!loading && rows.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {rows.map(row => (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: row.include ? 'var(--bg2)' : 'transparent', opacity: row.include ? 1 : 0.5 }}>
                <input type="checkbox" checked={row.include} onChange={() => toggleRow(row.id)} style={{ width: 16, height: 16, cursor: 'pointer' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{row.feeType}{row.level ? ` — ${row.level}` : ''}</div>
                </div>
                <input
                  type="number"
                  value={row.editedAmount}
                  disabled={!row.include}
                  onChange={e => setRowAmount(row.id, e.target.value)}
                  style={{ width: 110, padding: '7px 10px', borderRadius: 8, fontSize: 14, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', textAlign: 'right' }}
                />
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>FCFA</span>
              </div>
            ))}
          </div>
        )}

        {error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={onClose}>
            Ignorer
          </button>
          <button
            style={{ flex: 1, padding: '11px', borderRadius: 11, fontSize: 15, fontWeight: 800, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: submitting ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: submitting ? 0.7 : 1 }}
            onClick={confirmReconduction}
            disabled={submitting || loading || rows.length === 0}
          >
            {submitting ? 'Reconduction…' : `Reconduire (${rows.filter(r => r.include).length})`}
          </button>
        </div>
      </div>
    </div>
  )
}
