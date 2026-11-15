'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Loader2, Bell, Percent, Calendar, Plus, Trash2 } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { fmtCFA } from '@/components/finance/ModalOverlay'
import {
  downloadReceiptPdf,
  type InvoiceDetailsPayload,
  type InstallmentItem,
} from './financeExtendedTypes'
import InvoicePaymentsHistorySection from './InvoicePaymentsHistorySection'

interface Props {
  invoiceId: string
  studentName: string
  feePlanName: string
  canManage: boolean
  onClose: () => void
  onUpdated: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface EditableTranche {
  label: string
  amount: string
  dueDate: string
}

const DISCOUNT_REASONS = [
  { value: 'SCHOLARSHIP', label: 'Bourse' },
  { value: 'SIBLING', label: 'Fratrie' },
  { value: 'SOCIAL', label: 'Aide sociale' },
  { value: 'STAFF_CHILD', label: 'Enfant du personnel' },
  { value: 'OTHER', label: 'Autre motif' },
]

function buildDefaultThreeTranches(totalAmount: number): EditableTranche[] {
  const base = Math.floor(totalAmount / 3)
  const remainder = totalAmount - base * 3
  const now = new Date()
  return [0, 1, 2].map((idx) => {
    const dt = new Date(now)
    dt.setMonth(dt.getMonth() + idx + 1)
    return {
      label: `Tranche ${idx + 1}`,
      amount: String(idx === 2 ? base + remainder : base),
      dueDate: dt.toISOString().slice(0, 10),
    }
  })
}

export default function InvoiceDetailsModal({
  invoiceId,
  studentName,
  feePlanName,
  canManage,
  onClose,
  onUpdated,
  onToast,
}: Props) {
  const [details, setDetails] = useState<InvoiceDetailsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // Installment editor
  const [editingInstallments, setEditingInstallments] = useState(false)
  const [tranches, setTranches] = useState<EditableTranche[]>([])

  // Discount form
  const [discountOpen, setDiscountOpen] = useState(false)
  const [reasonType, setReasonType] = useState('SCHOLARSHIP')
  const [discountMode, setDiscountMode] = useState<'amount' | 'percentage'>('amount')
  const [discountValue, setDiscountValue] = useState('')
  const [discountJustif, setDiscountJustif] = useState('')

  // Payment promise
  const [promiseDate, setPromiseDate] = useState('')
  const [promiseNote, setPromiseNote] = useState('')

  const loadDetails = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchApi(`/api/v2/finance/invoices/${invoiceId}/details`, { credentials: 'include' })
      const json = (await res.json()) as { success?: boolean; data?: InvoiceDetailsPayload; message?: string }
      if (!res.ok || !json.data) throw new Error(json.message || 'Erreur chargement facture')
      setDetails(json.data)
      if (json.data.invoice.promisedPaymentDate) {
        setPromiseDate(new Date(json.data.invoice.promisedPaymentDate).toISOString().slice(0, 10))
      }
      setPromiseNote(json.data.invoice.promisedPaymentNote ?? '')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur chargement détails', 'error')
    } finally {
      setLoading(false)
    }
  }, [invoiceId, onToast])

  useEffect(() => {
    void loadDetails()
  }, [loadDetails])

  const openInstallmentEditor = (existing: InstallmentItem[], totalAmount: number) => {
    if (existing.length > 0) {
      setTranches(
        existing.map((it) => ({
          label: it.label,
          amount: String(it.amount),
          dueDate: new Date(it.dueDate).toISOString().slice(0, 10),
        }))
      )
    } else {
      setTranches(buildDefaultThreeTranches(totalAmount))
    }
    setEditingInstallments(true)
  }

  const saveInstallments = async () => {
    if (!details) return
    const parsed = tranches.map((tr) => ({
      label: tr.label.trim(),
      amount: Number(tr.amount),
      dueDate: tr.dueDate,
    }))
    if (parsed.some((tr) => !tr.label || !tr.dueDate || Number.isNaN(tr.amount) || tr.amount <= 0)) {
      onToast('Veuillez remplir chaque tranche avec un montant positif et une échéance', 'error')
      return
    }
    setBusy(true)
    try {
      const res = await fetchApi(`/api/v2/finance/invoices/${invoiceId}/installments`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tranches: parsed }),
      })
      const json = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(json.message || 'Erreur mise à jour échéancier')
      onToast('Échéancier enregistré', 'success')
      setEditingInstallments(false)
      await loadDetails()
      onUpdated()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur échéancier', 'error')
    } finally {
      setBusy(false)
    }
  }

  const submitDiscount = async (e: React.FormEvent) => {
    e.preventDefault()
    const num = Number(discountValue)
    if (!discountJustif.trim() || Number.isNaN(num) || num <= 0) {
      onToast('Montant/pourcentage positif et justification obligatoires', 'error')
      return
    }
    setBusy(true)
    try {
      const payload =
        discountMode === 'amount'
          ? { reasonType, amount: num, justification: discountJustif.trim() }
          : { reasonType, percentage: num, justification: discountJustif.trim() }
      const res = await fetchApi(`/api/v2/finance/invoices/${invoiceId}/discounts`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(json.message || 'Erreur application remise')
      onToast('Remise accordée et facture mise à jour', 'success')
      setDiscountOpen(false)
      setDiscountValue('')
      setDiscountJustif('')
      await loadDetails()
      onUpdated()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur remise', 'error')
    } finally {
      setBusy(false)
    }
  }

  const submitPromise = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!promiseDate) {
      onToast('Date de promesse requise', 'error')
      return
    }
    setBusy(true)
    try {
      const res = await fetchApi(`/api/v2/finance/invoices/${invoiceId}/promise`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ promisedDate: promiseDate, note: promiseNote.trim() || undefined }),
      })
      const json = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(json.message || 'Erreur enregistrement promesse')
      onToast('Promesse de paiement enregistrée', 'success')
      await loadDetails()
      onUpdated()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur promesse', 'error')
    } finally {
      setBusy(false)
    }
  }

  const sendReminder = async () => {
    setBusy(true)
    try {
      const res = await fetchApi(`/api/v2/finance/invoices/${invoiceId}/remind`, {
        method: 'POST',
        credentials: 'include',
      })
      const json = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(json.message || 'Erreur envoi relance')
      onToast(json.message || 'Relance envoyée aux parents (Push + SMS)', 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur relance', 'error')
    } finally {
      setBusy(false)
    }
  }

  const submitCancelPayment = async (paymentId: string, reason: string): Promise<boolean> => {
    setBusy(true)
    try {
      const res = await fetchApi(`/api/v2/finance/payments/${paymentId}/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })
      const json = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(json.message || 'Erreur annulation paiement')
      onToast('Paiement annulé avec contre-passation comptable', 'success')
      await loadDetails()
      onUpdated()
      return true
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur annulation', 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const handlePdf = async (paymentId: string, duplicate: boolean) => {
    try {
      await downloadReceiptPdf(paymentId, { duplicate })
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur téléchargement reçu PDF', 'error')
    }
  }

  const verifyMobilePayment = async (paymentId: string) => {
    setBusy(true)
    try {
      const res = await fetchApi('/api/v2/finance/payments/mobile/verify', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId, paymentId }),
      })
      const json = (await res.json()) as { success?: boolean; data?: { statut?: string; message?: string }; message?: string }
      if (!res.ok) throw new Error(json.message || 'Erreur vérification Campay')
      const st = json.data?.statut
      onToast(json.data?.message || (st === 'SUCCESS' ? 'Paiement validé' : 'Statut vérifié'), st === 'SUCCESS' ? 'success' : st === 'FAILED' ? 'error' : 'info')
      await loadDetails()
      onUpdated()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur vérification Campay', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.48)', zIndex: 1000,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 14,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 720,
          maxHeight: '90vh', overflowY: 'auto', padding: 20,
          boxShadow: '0 20px 60px rgba(0,0,0,0.22)', border: '1px solid var(--border)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>
              Détails facture — {studentName}
            </h3>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{feePlanName}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ background: 'var(--bg2)', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
            <X size={16} />
          </button>
        </div>

        {loading || !details ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 36, color: 'var(--text3)', gap: 8 }}>
            <Loader2 size={18} className="animate-spin" /> Chargement...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
              <div style={{ padding: 10, borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>Montant net</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{fmtCFA(details.invoice.amount)}</div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, background: 'var(--green-light)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--green)' }}>Déjà payé</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--green)' }}>{fmtCFA(details.totalPaid)}</div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, background: 'var(--amber-light)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--amber)' }}>Reste à payer</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--amber)' }}>{fmtCFA(details.remainingBalance)}</div>
              </div>
              <div style={{ padding: 10, borderRadius: 10, background: 'var(--blue-light)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 11, color: 'var(--blue)' }}>Avoir élève</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--blue)' }}>{fmtCFA(details.studentCreditBalance)}</div>
              </div>
            </div>

            {canManage && details.remainingBalance > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button type="button" disabled={busy} onClick={() => void sendReminder()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--primary)' }}>
                  <Bell size={13} /> Relancer parents (Push + SMS)
                </button>
              </div>
            )}

            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 13, color: 'var(--text)' }}>
                  Échéancier ({details.installments.length || 0} tranches)
                </strong>
                {canManage && !editingInstallments && (
                  <button type="button" onClick={() => openInstallmentEditor(details.installments, details.invoice.amount)} style={{ fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)' }}>
                    Configurer (3 tranches / perso)
                  </button>
                )}
              </div>

              {editingInstallments ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {tranches.map((tr, idx) => (
                    <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr auto', gap: 6, alignItems: 'center' }}>
                      <input value={tr.label} onChange={(e) => setTranches((prev) => prev.map((x, i) => (i === idx ? { ...x, label: e.target.value } : x)))} placeholder={`Tranche ${idx + 1}`} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 12 }} />
                      <input type="number" value={tr.amount} onChange={(e) => setTranches((prev) => prev.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 12 }} />
                      <input type="date" value={tr.dueDate} onChange={(e) => setTranches((prev) => prev.map((x, i) => (i === idx ? { ...x, dueDate: e.target.value } : x)))} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 12 }} />
                      <button type="button" onClick={() => setTranches((prev) => prev.filter((_, i) => i !== idx))} disabled={tranches.length <= 1} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--red)' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <button type="button" onClick={() => setTranches((prev) => [...prev, { label: `Tranche ${prev.length + 1}`, amount: '0', dueDate: new Date().toISOString().slice(0, 10) }])} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>
                      <Plus size={13} /> Ajouter une tranche
                    </button>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button type="button" onClick={() => setEditingInstallments(false)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', fontSize: 12, cursor: 'pointer' }}>
                        Annuler
                      </button>
                      <button type="button" disabled={busy} onClick={() => void saveInstallments()} style={{ padding: '5px 12px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Enregistrer
                      </button>
                    </div>
                  </div>
                </div>
              ) : details.installments.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucune tranche configurée pour cette facture.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {details.installments.map((inst) => (
                    <div key={inst.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12, padding: '6px 8px', background: 'var(--bg2)', borderRadius: 7 }}>
                      <span>
                        <strong>{inst.label}</strong> — échéance {new Date(inst.dueDate).toLocaleDateString('fr-FR')}
                      </span>
                      <span style={{ fontWeight: 700 }}>
                        {fmtCFA(inst.paidAmount)} / {fmtCFA(inst.amount)} ({inst.status})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: 13, color: 'var(--text)' }}>Remises accordées ({details.discounts.length})</strong>
                {canManage && (
                  <button type="button" onClick={() => setDiscountOpen((v) => !v)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)' }}>
                    <Percent size={12} /> Accorder une remise
                  </button>
                )}
              </div>
              {discountOpen && (
                <form onSubmit={submitDiscount} style={{ display: 'grid', gap: 8, marginBottom: 10, padding: 10, background: 'var(--bg2)', borderRadius: 8 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <select value={reasonType} onChange={(e) => setReasonType(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 12 }}>
                      {DISCOUNT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <select value={discountMode} onChange={(e) => setDiscountMode(e.target.value as 'amount' | 'percentage')} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 12 }}>
                      <option value="amount">Montant (XAF)</option>
                      <option value="percentage">Pourcentage (%)</option>
                    </select>
                    <input
                      type="number"
                      min="1"
                      placeholder={discountMode === 'amount' ? 'Montant XAF' : 'Pourcentage %'}
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 12 }}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Justification obligatoire (ex. décision conseil / attestation fratrie)..."
                    value={discountJustif}
                    onChange={(e) => setDiscountJustif(e.target.value)}
                    style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 12 }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <button type="submit" disabled={busy} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      Appliquer la remise
                    </button>
                  </div>
                </form>
              )}
              {details.discounts.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucune remise enregistrée.</div>
              ) : (
                details.discounts.map((d) => (
                  <div key={d.id} style={{ fontSize: 12, padding: '6px 8px', background: 'var(--bg2)', borderRadius: 7, marginBottom: 4 }}>
                    <strong>-{fmtCFA(d.amount)}</strong> ({d.reasonType}{d.percentage ? `, ${d.percentage}%` : ''}) — {d.justification}
                  </div>
                ))
              )}
            </div>

            {/* Promesse de paiement */}
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
              <strong style={{ fontSize: 13, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                <Calendar size={14} /> Promesse de paiement
              </strong>
              {canManage ? (
                <form onSubmit={submitPromise} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                  <input type="date" value={promiseDate} onChange={(e) => setPromiseDate(e.target.value)} style={{ padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 12 }} />
                  <input type="text" placeholder="Note / engagement parent..." value={promiseNote} onChange={(e) => setPromiseNote(e.target.value)} style={{ flex: 1, minWidth: 160, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 12 }} />
                  <button type="submit" disabled={busy} style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: 'var(--surface)', outline: '1px solid var(--border2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Enregistrer promesse
                  </button>
                </form>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {details.invoice.promisedPaymentDate
                    ? `Promis pour le ${new Date(details.invoice.promisedPaymentDate).toLocaleDateString('fr-FR')} — ${details.invoice.promisedPaymentNote ?? ''}`
                    : 'Aucune promesse enregistrée.'}
                </div>
              )}
            </div>

            <InvoicePaymentsHistorySection
              payments={details.payments}
              canManage={canManage}
              busy={busy}
              onCancelPayment={submitCancelPayment}
              onVerifyPayment={verifyMobilePayment}
              onDownloadPdf={handlePdf}
              onToast={onToast}
            />
          </div>
        )}
      </div>
    </div>
  )
}
