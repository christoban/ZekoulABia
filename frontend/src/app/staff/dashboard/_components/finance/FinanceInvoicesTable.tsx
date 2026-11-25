'use client'

import { AlertTriangle, Banknote, Eye, Loader2, RefreshCw, Smartphone } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { fmtCFA } from '@/components/finance/ModalOverlay'
import {
  INVOICE_STATUS_STYLES,
  type FinanceInvoiceItem,
  type FinancePagination,
} from '@/features/finance/financeShared'
import {
  btnSec,
  btnSecSm,
  filterSt,
  getInvoicePaidAmount,
  getInvoiceStatusTranslationKey,
  tdSt,
  thSt,
} from './financeStaffStyles'

interface FinanceInvoicesTableProps {
  invoices: FinanceInvoiceItem[]
  pag: FinancePagination
  page: number
  loading: boolean
  error: string | null
  statusFilter: string
  hasMF: boolean
  payingId: string | null
  verifyingId: string | null
  sendingId: string | null
  pendingCampayRefs: Record<string, string>
  onStatusFilterChange: (value: string) => void
  onPageChange: (page: number) => void
  onRefresh: (page: number) => void
  onRecordCash: (invoice: FinanceInvoiceItem) => void
  onInitiateMobileMoney: (invoice: FinanceInvoiceItem) => void
  onVerifyMobileMoney: (invoiceId: string) => void
  onSendSmsReminder: (invoice: FinanceInvoiceItem) => void
  onOpenDetails: (details: { id: string; studentName: string; feePlanName: string }) => void
}

export default function FinanceInvoicesTable({
  invoices,
  pag,
  page,
  loading,
  error,
  statusFilter,
  hasMF,
  payingId,
  verifyingId,
  sendingId,
  pendingCampayRefs,
  onStatusFilterChange,
  onPageChange,
  onRefresh,
  onRecordCash,
  onInitiateMobileMoney,
  onVerifyMobileMoney,
  onSendSmsReminder,
  onOpenDetails,
}: FinanceInvoicesTableProps) {
  const t = useT('staff')

  const openDetailsFor = (inv: FinanceInvoiceItem) =>
    onOpenDetails({
      id: inv.id,
      studentName: `${inv.student.lastName} ${inv.student.firstName}`,
      feePlanName: inv.feePlan?.name ?? 'Frais de scolarité',
    })

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <select
          value={statusFilter}
          onChange={e => onStatusFilterChange(e.target.value)}
          style={filterSt}
          className="min-h-[38px] text-xs"
        >
          <option value="">{t('finance.filterAllStatuses')}</option>
          <option value="PENDING">{t('finance.filterUnpaid')}</option>
          <option value="PARTIAL">{t('finance.filterPartial')}</option>
          <option value="PAID">{t('finance.filterPaid')}</option>
          <option value="OVERDUE">{t('finance.filterOverdue')}</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          {t('finance.pageInfo', { page: pag.page, pages: pag.pages, total: pag.total })}
        </span>
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <div
              style={{
                width: 32,
                height: 32,
                border: '3px solid var(--border)',
                borderTopColor: 'var(--green)',
                borderRadius: '50%',
                animation: 'edu-spin 0.7s linear infinite',
              }}
            />
          </div>
        ) : error ? (
          <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px', margin: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={15} strokeWidth={2} />
            <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, fontSize: 13 }}>{error}</span>
            <button
              onClick={() => onRefresh(page)}
              style={{
                padding: '5px 12px',
                borderRadius: 8,
                background: 'var(--surface)',
                color: 'var(--red)',
                border: '1.5px solid rgba(220,38,38,0.3)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              {t('finance.refresh')}
            </button>
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text3)', fontSize: 13 }}>
            {t('finance.noInvoices')}
          </div>
        ) : (
          <>
            <div className="md:hidden divide-y divide-[var(--border)]">
              {invoices.map(inv => {
                const totalPaid = getInvoicePaidAmount(inv.payments)
                const stCfg = INVOICE_STATUS_STYLES[inv.status] || { bg: 'var(--bg2)', color: 'var(--text2)' }
                const hasPendingCampay = Boolean(pendingCampayRefs[inv.id]) || inv.payments.some(p => p.status === 'PENDING')
                return (
                  <div key={inv.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-bold text-sm text-[var(--text)]">
                        {inv.student.lastName} {inv.student.firstName}
                      </div>
                      <span style={{ background: stCfg.bg, color: stCfg.color, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                        {t(getInvoiceStatusTranslationKey(inv.status))}
                      </span>
                    </div>

                    <div className="text-xs text-[var(--text2)]">{inv.feePlan?.name ?? '—'}</div>

                    <div className="grid grid-cols-2 gap-2 p-2.5 rounded-lg bg-[var(--bg)] text-xs">
                      <div>
                        <span className="text-[10px] text-[var(--text3)] uppercase font-bold block">{t('finance.tableHeaderAmount')}</span>
                        <span className="font-bold text-[var(--text)]">{fmtCFA(inv.amount)}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[var(--text3)] uppercase font-bold block">{t('finance.tableHeaderPaid')}</span>
                        <span className="font-bold text-[var(--green)]">{fmtCFA(totalPaid)}</span>
                      </div>
                    </div>

                    {inv.status !== 'PAID' && (
                      <div className="flex items-center gap-2 pt-1 flex-wrap">
                        {hasMF && (
                          <button
                            style={{ ...btnSecSm, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'var(--green-light)', color: 'var(--green)', borderColor: 'var(--green)' }}
                            className="min-h-[38px] px-3 text-xs font-semibold"
                            disabled={payingId === inv.id}
                            onClick={() => onRecordCash(inv)}
                          >
                            {payingId === inv.id ? <Loader2 size={13} className="animate-spin" /> : <Banknote size={13} />}
                            {t('finance.cashBtn') || 'Espèces'}
                          </button>
                        )}
                        <button
                          style={{ ...btnSecSm, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                          className="flex-1 min-h-[38px] text-xs font-semibold"
                          disabled={payingId === inv.id}
                          onClick={() => onInitiateMobileMoney(inv)}
                        >
                          {payingId === inv.id ? <Loader2 size={13} className="animate-spin" /> : <Smartphone size={13} />}
                          Mobile Money
                        </button>
                        {hasPendingCampay && (
                          <button
                            style={{ ...btnSecSm, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, background: 'var(--amber-light)', color: 'var(--amber)', borderColor: 'var(--amber)' }}
                            className="min-h-[38px] px-3 text-xs font-semibold"
                            disabled={verifyingId === inv.id}
                            onClick={() => onVerifyMobileMoney(inv.id)}
                          >
                            {verifyingId === inv.id ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                            Vérifier Campay
                          </button>
                        )}
                        <button
                          style={btnSecSm}
                          className="min-h-[38px] px-3 text-xs font-semibold"
                          disabled={sendingId === inv.id}
                          onClick={() => onSendSmsReminder(inv)}
                        >
                          {sendingId === inv.id ? <Loader2 size={13} className="animate-spin" /> : 'SMS'}
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      style={{ ...btnSecSm, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                      className="min-h-[34px] px-3 text-xs font-semibold"
                      onClick={() => openDetailsFor(inv)}
                    >
                      <Eye size={12} /> Détails / Tranches / Reçus
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={thSt}>{t('finance.tableHeaderStudent')}</th>
                    <th style={thSt}>{t('finance.tableHeaderPlan')}</th>
                    <th style={thSt}>{t('finance.tableHeaderAmount')}</th>
                    <th style={thSt}>{t('finance.tableHeaderPaid')}</th>
                    <th style={thSt}>{t('finance.tableHeaderStatus')}</th>
                    <th style={thSt}>{t('finance.tableHeaderActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const totalPaid = getInvoicePaidAmount(inv.payments)
                    const stCfg = INVOICE_STATUS_STYLES[inv.status] || { bg: 'var(--bg2)', color: 'var(--text2)' }
                    const hasPendingCampay = Boolean(pendingCampayRefs[inv.id]) || inv.payments.some(p => p.status === 'PENDING')
                    return (
                      <tr key={inv.id}>
                        <td style={tdSt}>
                          <span style={{ fontWeight: 700, color: 'var(--text)' }}>
                            {inv.student.lastName} {inv.student.firstName}
                          </span>
                        </td>
                        <td style={tdSt}>
                          <span style={{ color: 'var(--text2)', fontSize: 12 }}>{inv.feePlan?.name ?? '—'}</span>
                        </td>
                        <td style={{ ...tdSt, fontWeight: 700 }}>{fmtCFA(inv.amount)}</td>
                        <td style={{ ...tdSt, color: 'var(--green)', fontWeight: 600 }}>{fmtCFA(totalPaid)}</td>
                        <td style={tdSt}>
                          <span style={{ background: stCfg.bg, color: stCfg.color, padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>
                            {t(getInvoiceStatusTranslationKey(inv.status))}
                          </span>
                        </td>
                        <td style={tdSt}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {inv.status !== 'PAID' && hasMF && (
                              <button
                                style={{ ...btnSecSm, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--green-light)', color: 'var(--green)', borderColor: 'var(--green)' }}
                                disabled={payingId === inv.id}
                                onClick={() => onRecordCash(inv)}
                                title={t('finance.cashBtn') || 'Encaisser en espèces'}
                              >
                                {payingId === inv.id ? <Loader2 size={11} className="animate-spin" /> : <Banknote size={11} />}
                                {t('finance.cashBtn') || 'Espèces'}
                              </button>
                            )}
                            {inv.status !== 'PAID' && (
                              <button
                                style={{ ...btnSecSm, display: 'flex', alignItems: 'center', gap: 4 }}
                                disabled={payingId === inv.id}
                                onClick={() => onInitiateMobileMoney(inv)}
                              >
                                {payingId === inv.id ? <Loader2 size={11} className="animate-spin" /> : <Smartphone size={11} />}
                                Mobile Money
                              </button>
                            )}
                            {inv.status !== 'PAID' && hasPendingCampay && (
                              <button
                                style={{ ...btnSecSm, display: 'flex', alignItems: 'center', gap: 4, background: 'var(--amber-light)', color: 'var(--amber)', borderColor: 'var(--amber)' }}
                                disabled={verifyingId === inv.id}
                                onClick={() => onVerifyMobileMoney(inv.id)}
                                title="Vérifier le statut du paiement Campay"
                              >
                                {verifyingId === inv.id ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                                Vérifier Campay
                              </button>
                            )}
                            {inv.status !== 'PAID' && (
                              <button
                                style={btnSecSm}
                                disabled={sendingId === inv.id}
                                onClick={() => onSendSmsReminder(inv)}
                              >
                                {sendingId === inv.id ? <Loader2 size={11} className="animate-spin" /> : 'SMS'}
                              </button>
                            )}
                            <button
                              type="button"
                              style={{ ...btnSecSm, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              onClick={() => openDetailsFor(inv)}
                            >
                              <Eye size={11} /> Détails
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {pag.pages > 1 && (
              <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 6 }}>
                <button style={btnSec} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
                  {t('finance.previous')}
                </button>
                <span style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                  {page}/{pag.pages}
                </span>
                <button style={btnSec} disabled={page >= pag.pages} onClick={() => onPageChange(page + 1)}>
                  {t('finance.next')}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
