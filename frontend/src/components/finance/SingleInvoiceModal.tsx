'use client'
import React, { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import ModalOverlay, {
  sLbCls, sLb, sInCls, sIn, sModalTitleCls,
  btnCancel, btnSubmit, fmtCFA,
} from './ModalOverlay'

interface Props {
  open: boolean
  onClose: () => void
  onCreated: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const EMPTY = { studentId: '', feePlanId: '', description: '', loading: false, error: '' }

export default function SingleInvoiceModal({ open, onClose, onCreated, onToast }: Props) {
  const t = useT('finance')
  const [form, setForm] = useState(EMPTY)
  const [students, setStudents] = useState<{ id: string; firstName: string; lastName: string; studentProfile?: { class?: { name: string } } | null }[]>([])
  const [plans, setPlans] = useState<{ id: string; name: string; amount: number }[]>([])
  const [modalLoading, setModalLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setForm(EMPTY)
    setModalLoading(true)
    Promise.all([
      fetchApi('/api/v2/users?role=STUDENT', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/finance/fee-plans', { credentials: 'include' }).then(r => r.json()),
    ])
      .then(([sData, pData]) => {
        setStudents(sData.data || [])
        setPlans(pData.data || [])
      })
      .catch(() => {})
      .finally(() => setModalLoading(false))
  }, [open])

  const handleClose = () => {
    setForm(EMPTY)
    onClose()
  }

  const handleSubmit = async () => {
    if (!form.studentId || !form.feePlanId) {
      setForm(f => ({ ...f, error: t('errors.select_student_and_plan') }))
      return
    }
    setForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const body: Record<string, string> = { studentId: form.studentId, feePlanId: form.feePlanId }
      if (form.description.trim()) body.description = form.description.trim()
      const res = await fetchApi('/api/v2/finance/invoices', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        const code = data.code || ''
        let errMsg = data.message || t('errors.server_error')
        if (res.status === 409)
          errMsg = t('errors.payment_in_progress')
        else if (res.status === 422 && code === 'SEUIL_LEGAL_DEPASSE')
          errMsg = t('errors.legal_threshold_exceeded')
        else if (res.status === 403 && code === 'SEPARATION_ORDONNATEUR')
          errMsg = t('errors.separation_ordinator')
        setForm(f => ({ ...f, error: errMsg, loading: false }))
        return
      }
      onToast(t('toasts.invoice_created'), 'success')
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
        {t('modals.create_invoice.title')}
      </div>

      {modalLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
          <div style={{ width: 26, height: 26, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      ) : (
        <>
          <div className={sLbCls} style={sLb}>{t('modals.create_invoice.student_label')}</div>
          <select className={sInCls} style={sIn} value={form.studentId} onChange={e => setForm(f => ({ ...f, studentId: e.target.value }))}>
            <option value="">{t('modals.create_invoice.student_placeholder')}</option>
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName}{s.studentProfile?.class ? ` — ${s.studentProfile.class.name}` : ''}
              </option>
            ))}
          </select>

          <div className={sLbCls} style={sLb}>{t('modals.create_invoice.plan_label')}</div>
          <select className={sInCls} style={sIn} value={form.feePlanId} onChange={e => setForm(f => ({ ...f, feePlanId: e.target.value }))}>
            <option value="">{t('modals.create_invoice.plan_placeholder')}</option>
            {plans.map(p => (
              <option key={p.id} value={p.id}>{p.name} — {fmtCFA(p.amount)}</option>
            ))}
          </select>

          <div className={sLbCls} style={sLb}>{t('modals.create_invoice.description_label')}</div>
          <input
            className={sInCls} style={sIn}
            placeholder={t('modals.create_invoice.description_placeholder')}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          />
        </>
      )}

      {form.error && (
        <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
          {form.error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <button style={btnCancel} onClick={handleClose}>{t('actions.cancel')}</button>
        <button
          style={{ ...btnSubmit, cursor: form.loading ? 'wait' : 'pointer', opacity: form.loading ? 0.7 : 1 }}
          onClick={handleSubmit}
          disabled={form.loading || modalLoading}
        >
          {form.loading ? t('loading.creating') : t('actions.create_invoice_action')}
        </button>
      </div>
    </ModalOverlay>
  )
}
