'use client'

import { Smartphone, Check, RefreshCw, Clock, Loader2 } from 'lucide-react'
import type { Toast } from '../../_types'
import { useT } from '@/lib/i18n'
import ParentInvoiceExtensions from '@/features/finance/ParentInvoiceExtensions'
import { btnPay, fmtCFA, getDueDateInfo, getPaidAmount, invStatus, tdSt, thSt, type Invoice } from './types'

interface Props {
  invoices: Invoice[]
  isOnline: boolean
  verifyingInvoiceId: string | null
  onOpenPayModal: (inv: Invoice) => void
  onVerifyPayment: (invoiceId: string) => void
  onReload: () => void
  onToast: (msg: string, type?: Toast['type']) => void
}

export default function InvoiceTableDesktop({
  invoices,
  isOnline,
  verifyingInvoiceId,
  onOpenPayModal,
  onVerifyPayment,
  onReload,
  onToast,
}: Props) {
  const tf = useT('finance')

  return (
    <div className="hidden md:block" style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
        <thead>
          <tr>
            {['Élève', 'Libellé de la facture', 'Montant', 'Réglé', 'Reste dû', 'Échéance / Délai', 'Statut', 'Actions'].map((h) => (
              <th key={h} style={thSt}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {invoices.map((inv) => {
            const INV_STATUS = invStatus(tf)
            const st = INV_STATUS[inv.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: inv.status }
            const paid = getPaidAmount(inv.payments)
            const remaining = Math.max(0, inv.amount - paid)
            const isPaid = remaining === 0 || inv.status === 'PAID'
            const canPay = !isPaid
            const dueInfo = getDueDateInfo(inv.dueDate, isPaid)

            return (
              <tr
                key={inv.id}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--bg)')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'var(--surface)')}
              >
                <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                  {inv.student.firstName} {inv.student.lastName}
                </td>
                <td style={{ ...tdSt, fontWeight: 600, color: 'var(--primary)' }}>
                  <div>{inv.feePlan?.name ?? inv.description ?? 'Frais scolaires'}</div>
                  <ParentInvoiceExtensions
                    invoiceId={inv.id}
                    invoiceStatus={inv.status}
                    installments={inv.installments}
                    discounts={inv.discounts}
                    payments={inv.payments}
                    promisedPaymentDate={inv.promisedPaymentDate}
                    promisedPaymentNote={inv.promisedPaymentNote}
                    onUpdated={onReload}
                    onToast={onToast}
                  />
                </td>
                <td style={{ ...tdSt, fontWeight: 700 }}>{fmtCFA(inv.amount)}</td>
                <td style={tdSt}>
                  <span style={{ fontWeight: 700, color: paid > 0 ? 'var(--green)' : 'var(--text3)' }}>
                    {paid > 0 ? fmtCFA(paid) : '—'}
                  </span>
                </td>
                <td style={tdSt}>
                  <span style={{ fontWeight: 700, color: remaining > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {remaining > 0 ? fmtCFA(remaining) : <Check size={14} strokeWidth={2.5} />}
                  </span>
                </td>
                <td style={tdSt}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 700,
                      background: dueInfo.bg,
                      color: dueInfo.color,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Clock size={11} />
                    {dueInfo.label}
                  </span>
                </td>
                <td style={tdSt}>
                  <span
                    style={{
                      padding: '2px 8px',
                      borderRadius: 12,
                      fontSize: 11,
                      fontWeight: 700,
                      background: st.bg,
                      color: st.color,
                    }}
                  >
                    {st.label}
                  </span>
                </td>
                <td style={tdSt}>
                  {canPay && (
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <button
                        style={{
                          ...btnPay,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          opacity: isOnline ? 1 : 0.6,
                          cursor: isOnline ? 'pointer' : 'not-allowed',
                        }}
                        disabled={!isOnline}
                        onClick={() => onOpenPayModal(inv)}
                      >
                        <Smartphone size={12} />
                        {isOnline ? 'Payer' : 'Connexion requise'}
                      </button>
                      <button
                        style={{
                          padding: '4px 8px',
                          borderRadius: 7,
                          fontSize: 11.5,
                          fontWeight: 600,
                          background: 'var(--bg2)',
                          color: 'var(--text2)',
                          border: '1px solid var(--border)',
                          cursor: isOnline && verifyingInvoiceId !== inv.id ? 'pointer' : 'not-allowed',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                        title="Vérifier si un paiement a déjà été validé sur votre mobile"
                        disabled={!isOnline || verifyingInvoiceId === inv.id}
                        onClick={() => onVerifyPayment(inv.id)}
                      >
                        {verifyingInvoiceId === inv.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <RefreshCw size={11} />
                        )}
                        Vérifier
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
