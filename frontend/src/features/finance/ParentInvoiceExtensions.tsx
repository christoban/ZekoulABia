'use client'

import { useState } from 'react'
import { Calendar, Download, Copy, Tag } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { downloadReceiptPdf } from './financeExtendedTypes'

interface ParentInstallment {
  id: string
  trancheNumber: number
  label: string
  amount: number
  paidAmount: number
  dueDate: string
  status: string
}

interface ParentDiscount {
  id: string
  reasonType: string
  amount: number
  justification: string
}

interface ParentPaymentSummary {
  id: string
  amount: number
  status: string
  method: string
  receiptNumber?: string | null
  provisionalReceiptNumber?: string | null
}

interface Props {
  invoiceId: string
  invoiceStatus: string
  installments?: ParentInstallment[]
  discounts?: ParentDiscount[]
  payments?: ParentPaymentSummary[]
  promisedPaymentDate?: string | null
  promisedPaymentNote?: string | null
  onUpdated: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

const fmtCFA = (v: number) => `${v.toLocaleString('fr-FR')} XAF`

export default function ParentInvoiceExtensions({
  invoiceId,
  invoiceStatus,
  installments = [],
  discounts = [],
  payments = [],
  promisedPaymentDate,
  promisedPaymentNote,
  onUpdated,
  onToast,
}: Props) {
  const [promiseOpen, setPromiseOpen] = useState(false)
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)

  const submitPromise = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!date) {
      onToast('Veuillez choisir une date de promesse', 'error')
      return
    }
    setSending(true)
    try {
      const res = await fetchApi(`/api/v2/parent/invoices/${invoiceId}/promise`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promisedDate: date, note: note.trim() || undefined }),
      })
      const json = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(json.message || 'Erreur enregistrement promesse')
      onToast('Promesse de paiement transmise à l’établissement', 'success')
      setPromiseOpen(false)
      onUpdated()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur promesse', 'error')
    } finally {
      setSending(false)
    }
  }

  const handleReceipt = async (paymentId: string, duplicate: boolean) => {
    try {
      await downloadReceiptPdf(paymentId, { duplicate })
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur téléchargement reçu', 'error')
    }
  }

  const downloadPayments = payments.filter((p) => p.status === 'SUCCESS' || p.status === 'PAID' || p.status === 'CANCELLED')

  if (
    installments.length === 0 &&
    discounts.length === 0 &&
    downloadPayments.length === 0 &&
    invoiceStatus === 'PAID' &&
    !promisedPaymentDate
  ) {
    return null
  }

  return (
    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border)', display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5 }}>
      {installments.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {installments.map((inst) => (
            <span
              key={inst.id}
              style={{
                padding: '3px 8px', borderRadius: 6, background: 'var(--bg2)', border: '1px solid var(--border)',
                color: inst.status === 'PAID' ? 'var(--green)' : 'var(--text2)', fontWeight: 600,
              }}
            >
              {inst.label}: {fmtCFA(inst.paidAmount)}/{fmtCFA(inst.amount)} ({new Date(inst.dueDate).toLocaleDateString('fr-FR')})
            </span>
          ))}
        </div>
      )}

      {discounts.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {discounts.map((d) => (
            <span key={d.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 7px', borderRadius: 6, background: 'var(--green-light)', color: 'var(--green)', fontWeight: 700 }}>
              <Tag size={11} /> Remise -{fmtCFA(d.amount)} ({d.justification})
            </span>
          ))}
        </div>
      )}

      {promisedPaymentDate && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--blue)', fontWeight: 600 }}>
          <Calendar size={12} /> Promesse : {new Date(promisedPaymentDate).toLocaleDateString('fr-FR')}
          {promisedPaymentNote ? ` (${promisedPaymentNote})` : ''}
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {downloadPayments.map((p) => (
          <div key={p.id} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => void handleReceipt(p.id, false)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: 'var(--text)' }}
            >
              <Download size={11} /> {p.receiptNumber ? `Reçu ${p.receiptNumber}` : 'Reçu PDF'}
            </button>
            <button
              type="button"
              onClick={() => void handleReceipt(p.id, true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 7px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: 'var(--text2)' }}
            >
              <Copy size={11} /> Duplicata
            </button>
          </div>
        ))}

        {invoiceStatus !== 'PAID' && invoiceStatus !== 'CANCELLED' && (
          <button
            type="button"
            onClick={() => setPromiseOpen((v) => !v)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', fontSize: 11, fontWeight: 700, cursor: 'pointer', color: 'var(--primary)' }}
          >
            <Calendar size={11} /> {promiseOpen ? 'Fermer' : 'Promettre un paiement'}
          </button>
        )}
      </div>

      {promiseOpen && (
        <form onSubmit={submitPromise} style={{ display: 'flex', flexWrap: 'wrap', gap: 6, padding: 8, background: 'var(--bg2)', borderRadius: 8 }}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 11.5 }} />
          <input type="text" placeholder="Message à l’intendant (optionnel)..." value={note} onChange={(e) => setNote(e.target.value)} style={{ flex: 1, minWidth: 140, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 11.5 }} />
          <button type="submit" disabled={sending} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
            Valider
          </button>
        </form>
      )}
    </div>
  )
}

