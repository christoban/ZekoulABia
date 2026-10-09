'use client'
import React, { useState, useEffect } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import ModalOverlay, {
  sLbCls, sLb, sInCls, sIn, sModalTitleCls,
  btnCancel, btnSubmit,
} from './ModalOverlay'

export interface FeePlan {
  id: string
  name: string
  amount: number
  currency: string
  feeType: string
  level: string | null
  description: string | null
  isRefundable: boolean
  dueDate: string | null
  createdAt: string
  status?: string
  _count?: { invoices: number }
}

interface Props {
  open: boolean
  plan: FeePlan | null
  onClose: () => void
  onUpdated: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function FeePlanEditModal({ open, plan, onClose, onUpdated, onToast }: Props) {
  const t = useT('finance')
  const ts = useT('staff')
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [level, setLevel] = useState('')
  const [status, setStatus] = useState('PUBLISHED')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open || !plan) return
    setName(plan.name || '')
    setAmount(plan.amount ? String(plan.amount) : '')
    setDescription(plan.description || '')
    setDueDate(plan.dueDate ? plan.dueDate.split('T')[0] : '')
    setLevel(plan.level || '')
    setStatus(plan.status || 'PUBLISHED')
    setError('')
    setLoading(false)
  }, [open, plan])

  if (!open || !plan) return null

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError(t('errors.name_required') || 'Le nom du plan est obligatoire')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError(t('errors.invalid_amount') || 'Veuillez saisir un montant valide')
      return
    }
    if (status === 'PUBLISHED' && parsedAmount <= 0) {
      setError(t('errors.amount_gt_zero') || 'Le montant doit être supérieur à 0 pour être publié et facturé')
      return
    }

    setLoading(true)
    setError('')
    try {
      const res = await fetchApi(`/api/v2/finance/fee-plans/${plan.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          amount: parsedAmount,
          description: description.trim() || undefined,
          dueDate: dueDate || null,
          level: level.trim() || null,
          status,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.generic_error'))

      const count = data.data?.facturesGenerees ?? 0
      const toastMsg = count > 0
        ? `${ts('finance.planUpdated') || 'Plan de frais mis à jour'} — ${count} facture(s) générée(s) automatiquement.`
        : (ts('finance.planUpdated') || 'Plan de frais mis à jour avec succès.')
      onToast(toastMsg, 'success')
      onUpdated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic_error'))
      setLoading(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div className={sModalTitleCls} style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
        {ts('finance.editPlanTitle') || 'Modifier le plan de frais'}
      </div>
      <div className="text-xs md:text-xs" style={{ color: 'var(--text3)', marginBottom: 14 }}>
        {plan.feeType} · {plan.name}
      </div>

      <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.name_label')}</div>
      <input
        className={sInCls} style={sIn}
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder={t('modals.create_fee_plan.name_placeholder')}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.amount_label')} (FCFA)</div>
          <input
            className={sInCls} style={sIn}
            type="number" min="0" step="500"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="ex: 5000"
          />
        </div>
        <div>
          <div className={sLbCls} style={sLb}>Niveau / Classe (optionnel)</div>
          <input
            className={sInCls} style={sIn}
            value={level}
            onChange={e => setLevel(e.target.value)}
            placeholder="Tous (ou ex: 6ème, 3ème...)"
          />
        </div>
      </div>

      <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.description_label')}</div>
      <input
        className={sInCls} style={sIn}
        value={description}
        onChange={e => setDescription(e.target.value)}
        placeholder={t('modals.create_fee_plan.description_placeholder')}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.due_date_label')}</div>
          <input
            className={sInCls} style={sIn}
            type="date"
            value={dueDate}
            onChange={e => setDueDate(e.target.value)}
          />
        </div>
        <div>
          <div className={sLbCls} style={sLb}>Statut du plan</div>
          <select
            className={sInCls} style={sIn}
            value={status}
            onChange={e => setStatus(e.target.value)}
          >
            <option value="PUBLISHED">{ts('finance.statusPublished') || 'Publié & Actif (Facturation automatique)'}</option>
            <option value="DRAFT">{ts('finance.statusDraft') || 'Brouillon'}</option>
            <option value="PENDING_VALIDATION">{ts('finance.statusPendingValidation') || 'En attente de validation'}</option>
          </select>
        </div>
      </div>

      <div style={{ background: 'var(--blue-light)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--blue)', fontWeight: 600, marginTop: 12, marginBottom: 12, lineHeight: 1.4 }}>
        ℹ️ {ts('finance.autoBilledInfo') || 'Facturation automatique : dès que le plan est publié avec un montant défini, chaque élève ciblé reçoit automatiquement sa facture à régler dans son espace parent.'}
      </div>

      {error && (
        <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button style={btnCancel} onClick={onClose}>{t('actions.cancel')}</button>
        <button
          style={{ ...btnSubmit, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
          onClick={handleSubmit}
          disabled={loading}
        >
          {loading ? t('loading.saving') : (ts('finance.savePlan') || 'Enregistrer')}
        </button>
      </div>
    </ModalOverlay>
  )
}
