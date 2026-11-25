'use client'

import type React from 'react'
import { useT } from '@/lib/i18n'
import { fmtCFA } from '@/components/finance/ModalOverlay'
import {
  INVOICE_STATUS_STYLES,
  type FinanceInvoiceItem as InvoiceItem,
  type FinancePagination as Pagination,
} from '@/features/finance/financeShared'

interface FinanceInvoicesTabProps {
  invoices: InvoiceItem[]
  pag: Pagination
  page: number
  setPage: React.Dispatch<React.SetStateAction<number>>
  invStatus: string
  onStatusChange: (status: string) => void
  totalAmount: number
  paidAmount: number
  pendingCount: number
  overdueCount: number
  onSelectDetails: (info: { id: string; studentName: string; feePlanName: string }) => void
}

export default function FinanceInvoicesTab({
  invoices,
  pag,
  page,
  setPage,
  invStatus,
  onStatusChange,
  totalAmount,
  paidAmount,
  pendingCount,
  overdueCount,
  onSelectDetails,
}: FinanceInvoicesTabProps) {
  const t = useT('finance')

  const getInvStatus = (status: string) => {
    const base = INVOICE_STATUS_STYLES[status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
    const labelMap: Record<string, string> = {
      PENDING: t('invoice_status.PENDING'),
      PAID: t('invoice_status.PAID'),
      OVERDUE: t('invoice_status.OVERDUE'),
      CANCELLED: t('invoice_status.CANCELLED'),
      PARTIAL: t('invoice_status.PARTIAL'),
    }
    return { ...base, label: labelMap[status] ?? status }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] md:text-[14px] font-bold text-[var(--text)]">{t('tabs.invoices')}</div>
        <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid var(--amber)' }}>
          Facturation gérée par l&apos;Intendant (Lecture seule)
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3" style={{ marginBottom: 14 }}>
        {[
          { label: t('kpi.total_billed'), val: fmtCFA(totalAmount) },
          { label: t('kpi.total_collected'), val: fmtCFA(paidAmount) },
          { label: t('kpi.pending'), val: String(pendingCount) },
          { label: t('kpi.overdue'), val: String(overdueCount) },
        ].map((k, i) => (
          <div key={i} className="p-2.5 md:px-3.5 md:py-3 rounded-xl border border-[var(--border)] shadow-xs md:shadow-none" style={{ background: 'var(--surface)' }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{k.label}</div>
            <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{k.val}</div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mb-3">
        <select
          value={invStatus}
          onChange={e => onStatusChange(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600 }}
        >
          <option value="">Tous les statuts ({pag.total})</option>
          <option value="PENDING">En attente</option>
          <option value="PAID">Payée</option>
          <option value="OVERDUE">En retard</option>
          <option value="PARTIAL">Partielle</option>
        </select>
      </div>

      <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden', background: 'var(--surface)' }}>
        <div className="md:hidden divide-y divide-[var(--border)]">
          {invoices.map((inv) => {
            const st = getInvStatus(inv.status)
            return (
              <div key={inv.id} className="p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-sm text-[var(--text)]">{inv.student.firstName} {inv.student.lastName}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10.5, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-[var(--text2)]">
                  <span>{inv.feePlan?.name ?? '—'}</span>
                  <span className="font-extrabold text-[var(--text)] text-sm">{fmtCFA(inv.amount)}</span>
                </div>
                {inv.dueDate && (
                  <div className="text-[11px] text-[var(--text3)] text-right">
                    Échéance : {new Date(inv.dueDate).toLocaleDateString('fr-FR')}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onSelectDetails({ id: inv.id, studentName: `${inv.student.firstName} ${inv.student.lastName}`, feePlanName: inv.feePlan?.name ?? 'Frais de scolarité' })}
                  style={{ padding: '5px 10px', borderRadius: 7, border: '1px solid var(--border2)', background: 'var(--bg2)', color: 'var(--text)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                >
                  Détails / Échéancier / Reçus
                </button>
              </div>
            )
          })}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
            <thead>
              <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text2)' }}>Élève</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text2)' }}>Plan de frais</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text2)', textAlign: 'right' }}>Montant</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text2)', textAlign: 'center' }}>Statut</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text2)', textAlign: 'right' }}>Échéance</th>
                <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text2)', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => {
                const st = getInvStatus(inv.status)
                return (
                  <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>{inv.student.firstName} {inv.student.lastName}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{inv.feePlan?.name ?? '—'}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>{fmtCFA(inv.amount)}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text3)' }}>
                      {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('fr-FR') : '—'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        type="button"
                        onClick={() => onSelectDetails({ id: inv.id, studentName: `${inv.student.firstName} ${inv.student.lastName}`, feePlanName: inv.feePlan?.name ?? 'Frais de scolarité' })}
                        style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}
                      >
                        Détails
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {pag.pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
          <button disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
            Précédent
          </button>
          <span style={{ padding: '5px 10px', fontSize: 12, fontWeight: 700 }}>{page} / {pag.pages}</span>
          <button disabled={page >= pag.pages} onClick={() => setPage(p => Math.min(pag.pages, p + 1))} style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}>
            Suivant
          </button>
        </div>
      )}
    </>
  )
}
