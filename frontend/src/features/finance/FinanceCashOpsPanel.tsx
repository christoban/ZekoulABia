'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, Lock, Link2, RefreshCw } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { fmtCFA } from '@/components/finance/ModalOverlay'
import type { CashClosureItem, UnmatchedPaymentItem } from './financeExtendedTypes'

interface InvoiceOption {
  id: string
  amount: number
  student: { firstName: string; lastName: string }
  feePlan?: { name: string } | null
}

interface Props {
  canManage: boolean
  invoices: InvoiceOption[]
  onReconciled: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function FinanceCashOpsPanel({ canManage, invoices, onReconciled, onToast }: Props) {
  const [closures, setClosures] = useState<CashClosureItem[]>([])
  const [unmatched, setUnmatched] = useState<UnmatchedPaymentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  // Cash closure form
  const [closureDate, setClosureDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [declaredCash, setDeclaredCash] = useState('')
  const [notes, setNotes] = useState('')

  // Reconciliation invoice selection per payment
  const [targetInvoiceByPayment, setTargetInvoiceByPayment] = useState<Record<string, string>>({})

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, uRes] = await Promise.all([
        fetchApi('/api/v2/finance/cash-closures', { credentials: 'include' }),
        fetchApi('/api/v2/finance/payments/unmatched', { credentials: 'include' }),
      ])
      if (cRes.ok) {
        const cJson = (await cRes.json()) as { data?: CashClosureItem[] }
        setClosures(cJson.data ?? [])
      }
      if (uRes.ok) {
        const uJson = (await uRes.json()) as { data?: UnmatchedPaymentItem[] }
        setUnmatched(uJson.data ?? [])
      }
    } catch {
      onToast('Erreur chargement clôtures / rapprochements', 'error')
    } finally {
      setLoading(false)
    }
  }, [onToast])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const submitClosure = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetchApi('/api/v2/finance/cash-closures', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closureDate,
          declaredCash: declaredCash.trim() !== '' ? Number(declaredCash) : null,
          notes: notes.trim() || undefined,
        }),
      })
      const json = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(json.message || 'Erreur clôture caisse')
      onToast('Clôture journalière enregistrée et verrouillée', 'success')
      setDeclaredCash('')
      setNotes('')
      await loadData()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur clôture', 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleReconcile = async (paymentId: string) => {
    const invoiceId = targetInvoiceByPayment[paymentId]?.trim()
    if (!invoiceId) {
      onToast('Sélectionnez ou saisissez une facture à rapprocher', 'error')
      return
    }
    setBusy(true)
    try {
      const res = await fetchApi(`/api/v2/finance/payments/${paymentId}/reconcile`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId }),
      })
      const json = (await res.json()) as { message?: string }
      if (!res.ok) throw new Error(json.message || 'Erreur rapprochement')
      onToast('Paiement rapproché à la facture', 'success')
      await loadData()
      onReconciled()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur rapprochement', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 32, gap: 8, color: 'var(--text3)' }}>
        <Loader2 size={18} className="animate-spin" /> Chargement clôtures et rapprochements...
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Clôture journalière de caisse */}
      <div className="dash-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Lock size={16} color="var(--primary)" />
            <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
              Clôture journalière de caisse
            </h3>
          </div>
          <button
            type="button"
            onClick={() => void loadData()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)' }}
            aria-label="Actualiser"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {canManage && (
          <form onSubmit={submitClosure} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, marginBottom: 14, padding: 12, background: 'var(--bg2)', borderRadius: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Date caisse</label>
              <input type="date" value={closureDate} onChange={(e) => setClosureDate(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 12 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Espèces comptées (optionnel)</label>
              <input type="number" min="0" placeholder="Ex: 150000" value={declaredCash} onChange={(e) => setDeclaredCash(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 12 }} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Observations</label>
              <input type="text" placeholder="Écart / commentaire..." value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%', padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 12 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button
                type="submit"
                disabled={busy}
                style={{ width: '100%', padding: '7px 12px', borderRadius: 8, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
              >
                Clôturer la caisse
              </button>
            </div>
          </form>
        )}

        {closures.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucune clôture enregistrée pour le moment.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '7px 8px' }}>Date</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Espèces</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Mobile Money</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Annulés</th>
                  <th style={{ padding: '7px 8px', textAlign: 'right' }}>Déclaré / Écart</th>
                  <th style={{ padding: '7px 8px' }}>Clôturé par</th>
                </tr>
              </thead>
              <tbody>
                {closures.map((c) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '7px 8px', fontWeight: 700 }}>{new Date(c.closureDate).toLocaleDateString('fr-FR')}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmtCFA(c.totalCash)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>{fmtCFA(c.totalMobileMoney)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right', color: 'var(--red)' }}>{fmtCFA(c.totalCancelled)}</td>
                    <td style={{ padding: '7px 8px', textAlign: 'right' }}>
                      {c.declaredCash !== null ? `${fmtCFA(c.declaredCash)} (${c.variance ?? 0})` : '—'}
                    </td>
                    <td style={{ padding: '7px 8px', color: 'var(--text2)' }}>
                      {c.closedBy ? `${c.closedBy.firstName} ${c.closedBy.lastName}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* File de rapprochement Mobile Money */}
      <div className="dash-card" style={{ padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Link2 size={16} color="var(--amber)" />
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>
            Paiements Mobile Money non rapprochés ({unmatched.length})
          </h3>
        </div>
        {unmatched.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucun paiement Campay en attente de rapprochement.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {unmatched.map((u) => (
              <div key={u.id} style={{ padding: 10, borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between', fontSize: 12 }}>
                <div>
                  <strong>{fmtCFA(u.amount)}</strong> • Réf Campay: <code>{u.campayRef ?? '—'}</code> • Tél: {u.phoneNumber ?? '—'}
                </div>
                {canManage && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <select
                      value={targetInvoiceByPayment[u.id] ?? ''}
                      onChange={(e) => setTargetInvoiceByPayment((prev) => ({ ...prev, [u.id]: e.target.value }))}
                      style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border2)', fontSize: 11.5, maxWidth: 260 }}
                    >
                      <option value="">Choisir une facture...</option>
                      {invoices.map((inv) => (
                        <option key={inv.id} value={inv.id}>
                          {inv.student.firstName} {inv.student.lastName} — {inv.feePlan?.name ?? 'Frais'} ({fmtCFA(inv.amount)})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleReconcile(u.id)}
                      style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                    >
                      Rapprocher
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

