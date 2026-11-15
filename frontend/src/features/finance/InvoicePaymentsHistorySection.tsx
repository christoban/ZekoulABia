'use client'

import { useState } from 'react'
import { Download, Copy, Ban, RefreshCw } from 'lucide-react'
import { fmtCFA } from '@/components/finance/ModalOverlay'
import type { PaymentDetailItem } from './financeExtendedTypes'

interface Props {
  payments: PaymentDetailItem[]
  canManage: boolean
  busy: boolean
  onCancelPayment: (paymentId: string, reason: string) => Promise<boolean>
  onVerifyPayment?: (paymentId: string) => Promise<void>
  onDownloadPdf: (paymentId: string, duplicate: boolean) => Promise<void>
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function InvoicePaymentsHistorySection({
  payments,
  canManage,
  busy,
  onCancelPayment,
  onVerifyPayment,
  onDownloadPdf,
  onToast,
}: Props) {
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [cancelReason, setCancelReason] = useState('')

  const handleConfirmCancel = async (paymentId: string) => {
    const trimmed = cancelReason.trim()
    if (!trimmed) {
      onToast('Motif d’annulation obligatoire', 'error')
      return
    }
    const ok = await onCancelPayment(paymentId, trimmed)
    if (ok) {
      setCancellingId(null)
      setCancelReason('')
    }
  }

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 10, padding: 12 }}>
      <strong style={{ fontSize: 13, color: 'var(--text)', display: 'block', marginBottom: 8 }}>
        Historique paiements &amp; reçus ({payments.length})
      </strong>
      {payments.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Aucun paiement enregistré.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {payments.map((p) => (
            <div key={p.id} style={{ padding: '8px 10px', borderRadius: 8, background: 'var(--bg2)', fontSize: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div>
                  <strong>{fmtCFA(p.amount)}</strong> • {p.method} • <span style={{ fontWeight: 700 }}>{p.status}</span>
                  {p.receiptNumber && <span style={{ marginLeft: 8, fontFamily: 'monospace' }}>#{p.receiptNumber}</span>}
                  {p.provisionalReceiptNumber && (
                    <span style={{ marginLeft: 6, color: 'var(--text3)' }}>({p.provisionalReceiptNumber})</span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {(p.status === 'SUCCESS' || p.status === 'CANCELLED') && (
                    <>
                      <button
                        type="button"
                        onClick={() => void onDownloadPdf(p.id, false)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6,
                          border: '1px solid var(--border2)', background: 'var(--surface)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        <Download size={11} /> Reçu PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDownloadPdf(p.id, true)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6,
                          border: '1px solid var(--border2)', background: 'var(--surface)', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        }}
                      >
                        <Copy size={11} /> Duplicata
                      </button>
                    </>
                  )}
                  {canManage && onVerifyPayment && p.status === 'PENDING' && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void onVerifyPayment(p.id)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6,
                        border: '1px solid var(--amber)', background: 'var(--amber-light)', color: 'var(--amber)',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      <RefreshCw size={11} /> Vérifier Campay
                    </button>
                  )}
                  {canManage && p.status === 'SUCCESS' && (
                    <button
                      type="button"
                      onClick={() => {
                        setCancellingId(p.id)
                        setCancelReason('')
                      }}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6,
                        border: '1px solid var(--red)', background: 'var(--red-light)', color: 'var(--red)',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}
                    >
                      <Ban size={11} /> Annuler
                    </button>
                  )}
                </div>
              </div>
              {p.cancellationReason && (
                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>
                  Motif d’annulation : {p.cancellationReason}
                </div>
              )}
              {cancellingId === p.id && (
                <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                  <input
                    type="text"
                    placeholder="Motif obligatoire d’annulation..."
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    style={{ flex: 1, padding: '5px 8px', borderRadius: 6, border: '1px solid var(--red)', fontSize: 11.5 }}
                  />
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void handleConfirmCancel(p.id)}
                    style={{
                      padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--red)', color: '#fff',
                      fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    }}
                  >
                    Confirmer
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancellingId(null)}
                    style={{
                      padding: '5px 8px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)',
                      fontSize: 11.5, cursor: 'pointer',
                    }}
                  >
                    Non
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

