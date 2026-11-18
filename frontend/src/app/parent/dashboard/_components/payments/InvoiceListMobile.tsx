'use client'

import { Smartphone, RefreshCw, Clock, Loader2 } from 'lucide-react'
import type { Toast } from '../../_types'
import { useT } from '@/lib/i18n'
import ParentInvoiceExtensions from '@/features/finance/ParentInvoiceExtensions'
import { fmtCFA, getDueDateInfo, getPaidAmount, invStatus, type Invoice } from './types'

interface Props {
  invoices: Invoice[]
  isOnline: boolean
  verifyingInvoiceId: string | null
  onOpenPayModal: (inv: Invoice) => void
  onVerifyPayment: (invoiceId: string) => void
  onReload: () => void
  onToast: (msg: string, type?: Toast['type']) => void
}

export default function InvoiceListMobile({
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
    <div className="md:hidden divide-y divide-[var(--border)]">
      {invoices.map((inv) => {
        const INV_STATUS = invStatus(tf)
        const st = INV_STATUS[inv.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: inv.status }
        const paid = getPaidAmount(inv.payments)
        const remaining = Math.max(0, inv.amount - paid)
        const isPaid = remaining === 0 || inv.status === 'PAID'
        const canPay = !isPaid
        const dueInfo = getDueDateInfo(inv.dueDate, isPaid)

        return (
          <div key={inv.id} className="p-3.5 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[13px] font-bold text-[var(--text)]">
                  {inv.student.firstName} {inv.student.lastName}
                </div>
                <div className="text-[12px] font-semibold text-[var(--primary)] mt-0.5">
                  {inv.feePlan?.name ?? inv.description ?? 'Frais scolaires'}
                </div>
              </div>
              <span
                style={{
                  padding: '3px 8px',
                  borderRadius: 12,
                  fontSize: 10.5,
                  fontWeight: 700,
                  background: st.bg,
                  color: st.color,
                  whiteSpace: 'nowrap',
                }}
              >
                {st.label}
              </span>
            </div>

            {/* Badge d'échéance */}
            <div className="flex items-center gap-1.5">
              <span
                className="px-2 py-0.5 rounded-md text-[10.5px] font-bold inline-flex items-center gap-1"
                style={{ background: dueInfo.bg, color: dueInfo.color }}
              >
                <Clock size={10} />
                {dueInfo.label}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-center text-xs">
              <div>
                <div className="text-[10px] uppercase font-bold text-[var(--text3)]">Total</div>
                <div className="font-bold text-[var(--text)] mt-0.5">{fmtCFA(inv.amount)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-[var(--text3)]">Réglé</div>
                <div className="font-bold mt-0.5" style={{ color: paid > 0 ? 'var(--green)' : 'var(--text3)' }}>
                  {paid > 0 ? fmtCFA(paid) : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-bold text-[var(--text3)]">Reste</div>
                <div className="font-bold mt-0.5" style={{ color: remaining > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {remaining > 0 ? fmtCFA(remaining) : 'Soldé'}
                </div>
              </div>
            </div>

            {canPay && (
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => onOpenPayModal(inv)}
                  disabled={!isOnline}
                  className="w-full h-9 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: isOnline
                      ? 'linear-gradient(135deg,var(--primary),var(--primary-hover))'
                      : 'var(--border)',
                    color: isOnline ? 'white' : 'var(--text3)',
                  }}
                >
                  <Smartphone size={13} />
                  {isOnline ? `Payer par Mobile Money (${fmtCFA(remaining)})` : 'Connexion requise pour payer'}
                </button>
                <button
                  onClick={() => onVerifyPayment(inv.id)}
                  disabled={!isOnline || verifyingInvoiceId === inv.id}
                  className="w-full h-8 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{
                    background: 'var(--bg2)',
                    color: 'var(--text2)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {verifyingInvoiceId === inv.id ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <RefreshCw size={12} />
                  )}
                  Vérifier le statut du paiement
                </button>
              </div>
            )}

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
          </div>
        )
      })}
    </div>
  )
}
