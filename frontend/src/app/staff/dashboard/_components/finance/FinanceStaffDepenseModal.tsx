'use client'

import { useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useSyncQueue } from '@/hooks/useSyncQueue'
import { DEPENSE_CATEGORIES, EMPTY_DEPENSE } from '@/features/finance/financeShared'
import { btnPrim, btnSec, fIn, fLb } from './financeStaffStyles'

interface FinanceStaffDepenseModalProps {
  onClose: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function FinanceStaffDepenseModal({ onClose, onToast }: FinanceStaffDepenseModalProps) {
  const t = useT('staff')
  const { addToQueue } = useSyncQueue()
  const [depenseForm, setDepenseForm] = useState(EMPTY_DEPENSE)
  const [depenseSending, setDepenseSending] = useState(false)
  const [depenseError, setDepenseError] = useState<string | null>(null)

  const submitDepense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!depenseForm.label.trim()) {
      setDepenseError(t('finance.depenseLabelRequired'))
      return
    }
    const amt = parseFloat(depenseForm.amount)
    if (!depenseForm.amount || isNaN(amt) || amt <= 0) {
      setDepenseError(t('finance.depenseAmountInvalid'))
      return
    }
    setDepenseSending(true)
    setDepenseError(null)

    const body: Record<string, unknown> = { label: depenseForm.label.trim(), amount: amt }
    if (depenseForm.category.trim()) body.category = depenseForm.category.trim()
    if (depenseForm.date) body.date = depenseForm.date

    if (!navigator.onLine) {
      try {
        const idempotencyKey = crypto.randomUUID()
        await addToQueue({
          type: 'EXPENSE_CREATE',
          endpoint: '/api/v2/finance/expenses',
          method: 'POST',
          idempotencyKey,
          payload: body,
        })
        onToast('Dépense enregistrée hors-ligne (en attente de synchronisation)', 'info')
        onClose()
        setDepenseForm(EMPTY_DEPENSE)
      } catch (err) {
        setDepenseError(err instanceof Error ? err.message : 'Erreur enregistrement hors-ligne')
      } finally {
        setDepenseSending(false)
      }
      return
    }

    try {
      const res = await fetchApi('/api/v2/finance/expenses', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      onToast(t('finance.depenseSuccess'), 'success')
      onClose()
      setDepenseForm(EMPTY_DEPENSE)
    } catch (err) {
      setDepenseError(err instanceof Error ? err.message : 'Erreur serveur')
    } finally {
      setDepenseSending(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={e => {
        if (e.target === e.currentTarget && !depenseSending) onClose()
      }}
    >
      <div
        style={{
          background: 'var(--surface)',
          borderRadius: 14,
          border: '1px solid var(--border)',
          width: '100%',
          maxWidth: 440,
          boxShadow: '0 20px 60px rgba(0,0,0,0.18)',
          overflow: 'hidden',
        }}
      >
        <div
          className="px-4 py-3 md:px-5 md:py-3.5"
          style={{
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>
            {t('finance.depenseModalTitle')}
          </div>
          <button
            onClick={() => !depenseSending && onClose()}
            style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text3)', cursor: 'pointer', lineHeight: 1, padding: 2 }}
          >
            ×
          </button>
        </div>

        <form onSubmit={submitDepense} className="px-4 py-3 md:px-5 md:py-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={fLb}>
              {t('finance.depenseLabelLabel')} <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              type="text"
              value={depenseForm.label}
              onChange={e => setDepenseForm(f => ({ ...f, label: e.target.value }))}
              placeholder={t('finance.depenseLabelPlaceholder')}
              style={fIn}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.background = 'var(--surface)'
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--border2)'
                e.currentTarget.style.background = 'var(--bg2)'
              }}
            />
          </div>
          <div>
            <label style={fLb}>
              {t('finance.depenseAmountLabel')} <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <input
              type="number"
              min="1"
              value={depenseForm.amount}
              onChange={e => setDepenseForm(f => ({ ...f, amount: e.target.value }))}
              placeholder={t('finance.depenseAmountPlaceholder')}
              style={fIn}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.background = 'var(--surface)'
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--border2)'
                e.currentTarget.style.background = 'var(--bg2)'
              }}
            />
          </div>
          <div>
            <label style={fLb}>
              {t('finance.depenseCategoryLabel')}{' '}
              <span style={{ color: 'var(--text3)', fontWeight: 600, fontSize: 11 }}>
                ({t('finance.depenseCategoryOptional')})
              </span>
            </label>
            <select
              value={depenseForm.category}
              onChange={e => setDepenseForm(f => ({ ...f, category: e.target.value }))}
              style={{ ...fIn, cursor: 'pointer' }}
            >
              <option value="">{t('finance.depenseCategoryPlaceholder')}</option>
              {DEPENSE_CATEGORIES.map(c => (
                <option key={c} value={c}>
                  {t(`finance.${c}`)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={fLb}>
              {t('finance.depenseDateLabel')}{' '}
              <span style={{ color: 'var(--text3)', fontWeight: 600, fontSize: 11 }}>
                ({t('finance.depenseDateOptional')})
              </span>
            </label>
            <input
              type="date"
              value={depenseForm.date}
              onChange={e => setDepenseForm(f => ({ ...f, date: e.target.value }))}
              style={fIn}
              onFocus={e => {
                e.currentTarget.style.borderColor = 'var(--primary)'
                e.currentTarget.style.background = 'var(--surface)'
              }}
              onBlur={e => {
                e.currentTarget.style.borderColor = 'var(--border2)'
                e.currentTarget.style.background = 'var(--bg2)'
              }}
            />
          </div>
          {depenseError && (
            <div
              style={{
                background: 'var(--red-light)',
                border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: 8,
                padding: '8px 12px',
                color: 'var(--red)',
                fontSize: 12,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <AlertTriangle size={13} strokeWidth={2} /> {depenseError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
            <button type="button" onClick={onClose} disabled={depenseSending} style={btnSec}>
              {t('finance.cancel')}
            </button>
            <button
              type="submit"
              disabled={depenseSending}
              style={{ ...btnPrim, opacity: depenseSending ? 0.7 : 1, cursor: depenseSending ? 'wait' : 'pointer' }}
            >
              {depenseSending ? t('finance.saving') : t('finance.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
