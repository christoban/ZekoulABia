'use client'
import React, { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import ModalOverlay, {
  sLbCls, sLb, sInCls, sIn, sModalTitleCls,
  btnCancel, btnSubmit,
} from './ModalOverlay'

interface Props {
  open: boolean
  planId: string
  planName: string
  onClose: () => void
  onGenerated: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function BulkInvoiceModal({ open, planId, planName, onClose, onGenerated, onToast }: Props) {
  const t = useT('finance')
  const [academicYearId, setAcademicYearId] = useState('')
  const [years, setYears] = useState<{ id: string; name: string }[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    setAcademicYearId('')
    setError('')
    setLoading(false)
    fetchApi('/api/v2/academic-years', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        const list = (d.data || []) as { id: string; name: string }[]
        setYears(list)
        if (list.length > 0) setAcademicYearId(list[0].id)
      })
      .catch(() => setYears([]))
  }, [open])

  const handleSubmit = async () => {
    if (!academicYearId) { setError(t('errors.select_year')); return }
    setLoading(true); setError('')
    try {
      const res = await fetchApi('/api/v2/finance/invoices/bulk', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feePlanId: planId, academicYearId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.generic_error'))
      onToast(t('toasts.invoices_generated').replace('{count}', String(data.count ?? 0)), 'success')
      onGenerated()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic_error'))
      setLoading(false)
    }
  }

  if (!open) return null

  return (
    <ModalOverlay onClose={onClose}>
      <div className={sModalTitleCls} style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
        {t('modals.bulk_generate.title')}
      </div>
      <div className="text-xs md:text-xs" style={{ color: 'var(--text3)', marginBottom: 14 }}>{planName}</div>

      <div className={sLbCls} style={sLb}>{t('modals.bulk_generate.year_label')}</div>
      <select className={sInCls} style={sIn} value={academicYearId} onChange={e => setAcademicYearId(e.target.value)}>
        <option value="">{t('modals.bulk_generate.year_placeholder')}</option>
        {years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
      </select>

      <div style={{ background: 'var(--amber-light)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--amber)', fontWeight: 600, marginBottom: 12 }}>
        {t('modals.bulk_generate.warning')}
      </div>

      {error && (
        <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnCancel} onClick={onClose}>{t('actions.cancel')}</button>
        <button
          style={{ ...btnSubmit, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? t('loading.generating') : t('actions.generate')}
        </button>
      </div>
    </ModalOverlay>
  )
}
