'use client'
import React, { useState } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import ModalOverlay, {
  sLbCls, sLb, sInCls, sIn, sModalTitleCls,
  btnCancel, btnSubmit, FEE_TYPES,
} from './ModalOverlay'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const EMPTY = { name: '', amount: '', feeType: 'TUITION', description: '', dueDate: '', isRefundable: false, loading: false, error: '' }

export default function FeePlanCreateModal({ open, onClose, onCreated, onToast }: Props) {
  const t = useT('finance')
  const [form, setForm] = useState(EMPTY)

  const FEE_TYPE_LABEL: Record<string, string> = {
    TUITION:      t('fee_type.TUITION'),
    REGISTRATION: t('fee_type.REGISTRATION'),
    EXAM:         t('fee_type.EXAM'),
    UNIFORM:      t('fee_type.UNIFORM'),
    TRANSPORT:    t('fee_type.TRANSPORT'),
    CAUTION:      t('fee_type.CAUTION'),
    OTHER:        t('fee_type.OTHER'),
  }

  const handleClose = () => {
    setForm(EMPTY)
    onClose()
  }

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.amount) {
      setForm(f => ({ ...f, error: t('errors.name_and_amount_required') }))
      return
    }
    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/finance/fee-plans', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          amount: parseFloat(form.amount),
          feeType: form.feeType,
          description: form.description.trim() || undefined,
          dueDate: form.dueDate || undefined,
          isRefundable: form.isRefundable,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.generic_error'))
      onToast(t('toasts.plan_created').replace('{name}', form.name), 'success')
      setForm(EMPTY)
      onCreated()
    } catch (err) {
      setForm(f => ({
        ...f,
        error: err instanceof Error ? err.message : t('errors.generic_error'),
        loading: false,
      }))
    }
  }

  if (!open) return null

  return (
    <ModalOverlay onClose={handleClose}>
      <div className={sModalTitleCls} style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>
        {t('modals.create_fee_plan.title')}
      </div>

      <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.name_label')}</div>
      <input
        className={sInCls} style={sIn}
        placeholder={t('modals.create_fee_plan.name_placeholder')}
        value={form.name}
        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.amount_label')}</div>
          <input
            className={sInCls} style={sIn}
            type="number" min="0"
            placeholder={t('modals.create_fee_plan.amount_placeholder')}
            value={form.amount}
            onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          />
        </div>
        <div>
          <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.type_label')}</div>
          <select
            className={sInCls} style={sIn}
            value={form.feeType}
            onChange={e => setForm(f => ({ ...f, feeType: e.target.value }))}
          >
            {FEE_TYPES.map(ft => <option key={ft} value={ft}>{FEE_TYPE_LABEL[ft] ?? ft}</option>)}
          </select>
        </div>
      </div>

      <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.description_label')}</div>
      <input
        className={sInCls} style={sIn}
        placeholder={t('modals.create_fee_plan.description_placeholder')}
        value={form.description}
        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
      />

      <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.due_date_label')}</div>
      <input
        className={sInCls} style={sIn}
        type="date"
        value={form.dueDate}
        onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input
          type="checkbox" id="refund-create"
          checked={form.isRefundable}
          onChange={e => setForm(f => ({ ...f, isRefundable: e.target.checked }))}
        />
        <label htmlFor="refund-create" style={{ fontSize: 12.5, color: 'var(--text2)', cursor: 'pointer' }}>
          {t('modals.create_fee_plan.refundable_label')}
        </label>
      </div>

      {form.error && (
        <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          {form.error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button style={btnCancel} onClick={handleClose}>{t('actions.cancel')}</button>
        <button
          style={{ ...btnSubmit, cursor: form.loading ? 'wait' : 'pointer', opacity: form.loading ? 0.7 : 1 }}
          onClick={handleSubmit}
          disabled={form.loading}
        >
          {form.loading ? t('loading.creating') : t('actions.create_plan')}
        </button>
      </div>
    </ModalOverlay>
  )
}
