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

  const handleSubmit = async (targetStatus?: string) => {
    if (!name.trim()) {
      setError(t('errors.name_required') || 'Le nom du plan est obligatoire')
      return
    }
    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError(t('errors.invalid_amount') || 'Veuillez saisir un montant valide')
      return
    }

    const finalStatus = targetStatus ?? (plan.status === 'PUBLISHED' ? 'PUBLISHED' : (plan.status || 'DRAFT'))

    if (finalStatus === 'PENDING_VALIDATION' && parsedAmount <= 0) {
      setError('Veuillez définir un montant supérieur à 0 avant de soumettre pour validation.')
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
          status: finalStatus,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.generic_error'))

      const count = data.data?.facturesGenerees ?? 0
      const toastMsg = finalStatus === 'PENDING_VALIDATION'
        ? (ts('finance.planSubmittedForValidation') || 'Plan de frais soumis pour validation à la Direction.')
        : count > 0
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
          <div className={sLbCls} style={sLb}>Statut actuel</div>
          <div
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              fontSize: 12.5,
              fontWeight: 700,
              background: plan.status === 'PUBLISHED' ? 'var(--green-light)' : plan.status === 'PENDING_VALIDATION' ? 'var(--amber-light)' : 'var(--bg2)',
              color: plan.status === 'PUBLISHED' ? 'var(--green)' : plan.status === 'PENDING_VALIDATION' ? 'var(--amber)' : 'var(--text2)',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            {plan.status === 'PUBLISHED' && '⚡ Publié & Actif'}
            {plan.status === 'PENDING_VALIDATION' && '⏳ En attente de validation (Direction)'}
            {(!plan.status || plan.status === 'DRAFT') && '✏️ Brouillon (Non soumis)'}
          </div>
        </div>
      </div>

      <div style={{ background: 'var(--blue-light)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--blue)', fontWeight: 600, marginTop: 12, marginBottom: 12, lineHeight: 1.4 }}>
        {plan.status === 'PUBLISHED'
          ? '⚡ Plan publié : les factures sont actives dans les espaces parents.'
          : 'ℹ️ Séparation des rôles : L\'intendant prépare le plan de frais. La validation officielle et l\'émission des factures sont opérées par le Chef d\'établissement (Direction).'}
      </div>

      {error && (
        <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
        <button style={btnCancel} onClick={onClose} disabled={loading}>{t('actions.cancel')}</button>
        {plan.status === 'PUBLISHED' ? (
          <button
            style={{ ...btnSubmit, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
            onClick={() => handleSubmit('PUBLISHED')}
            disabled={loading}
          >
            {loading ? (t('loading.saving') || 'Enregistrement...') : (ts('finance.savePlan') || 'Enregistrer les modifications')}
          </button>
        ) : (
          <>
            <button
              type="button"
              style={{
                ...btnCancel,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                cursor: loading ? 'wait' : 'pointer',
                fontWeight: 600,
              }}
              onClick={() => handleSubmit('DRAFT')}
              disabled={loading}
            >
              {loading ? '...' : (ts('finance.saveDraft') || 'Enregistrer en brouillon')}
            </button>
            <button
              type="button"
              style={{
                ...btnSubmit,
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
              onClick={() => handleSubmit('PENDING_VALIDATION')}
              disabled={loading}
            >
              {loading ? (t('loading.saving') || 'Envoi...') : (ts('finance.submitForValidation') || 'Soumettre pour validation')}
            </button>
          </>
        )}
      </div>
    </ModalOverlay>
  )
}

