'use client'

import { CheckCircle2, Clock } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { fmtCFA } from '@/components/finance/ModalOverlay'

export interface RecentPaymentRow {
  id: string
  amount: number
  method?: string | null
  paidAt?: string | null
  studentName: string
  feePlanName: string
}

interface FinanceSupervisionTabProps {
  recoveryRate: number
  totalAmount: number
  paidAmount: number
  overdueCount: number
  recentPayments: RecentPaymentRow[]
  onGoToInvoices: () => void
}

export default function FinanceSupervisionTab({
  recoveryRate,
  totalAmount,
  paidAmount,
  overdueCount,
  recentPayments,
  onGoToInvoices,
}: FinanceSupervisionTabProps) {
  const t = useT('finance')

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
        <div className="p-3 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Taux de Recouvrement</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--green)', marginTop: 4 }}>{recoveryRate}%</div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Total Facturé</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', marginTop: 4 }}>{fmtCFA(totalAmount)}</div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Total Encaissé</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green)', marginTop: 4 }}>{fmtCFA(paidAmount)}</div>
        </div>
        <div className="p-3 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Factures en Retard</div>
          <div style={{ fontSize: 20, fontWeight: 900, color: overdueCount > 0 ? 'var(--red)' : 'var(--text)', marginTop: 4 }}>
            {overdueCount}
          </div>
        </div>
      </div>

      <div className="p-3 md:p-3.5 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-1.5 mb-2">
          <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--amber)' }} />
          <div className="text-[12.5px] md:text-[13.5px] font-bold text-[var(--text)]">
            {t('supervision_queue.title')}
          </div>
        </div>
        {overdueCount === 0 ? (
          <div className="text-xs font-semibold text-success bg-success/10 border border-success/20 rounded-lg p-2.5 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
            <span>{t('supervision_queue.all_clear')}</span>
          </div>
        ) : (
          <div className="rounded-lg p-2.5 flex items-center justify-between" style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)' }}>
            <span className="text-xs font-bold" style={{ color: 'var(--amber)' }}>
              {t('supervision_queue.overdue_invoices').replace('{count}', String(overdueCount))}
            </span>
            <button onClick={onGoToInvoices} className="text-[11px] font-bold underline hover:no-underline ml-2" style={{ color: 'var(--amber)' }}>
              Examiner les factures
            </button>
          </div>
        )}
      </div>

      <div className="p-3 md:p-3.5 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="text-[13px] font-bold text-[var(--text)] flex items-center gap-2">
            <Clock size={16} style={{ color: 'var(--blue)' }} /> Historique des opérations financières récentes
          </div>
          <span className="text-[11px] text-[var(--text3)]">Saisies par l&apos;Intendant</span>
        </div>

        {recentPayments.length === 0 ? (
          <p style={{ color: 'var(--text3)', fontSize: 12, fontStyle: 'italic', margin: 0 }}>
            Aucune écriture financière récente enregistrée.
          </p>
        ) : (
          <>
            <div className="md:hidden divide-y divide-[var(--border)]">
              {recentPayments.map((p) => (
                <div key={p.id} className="py-2.5 space-y-1 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-[var(--text)]">{p.studentName}</span>
                    <span className="font-extrabold text-[var(--green)]">{fmtCFA(p.amount)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--text2)]">
                    <span>{p.feePlanName}</span>
                    <span style={{ padding: '1.5px 6px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: p.method === 'CASH' ? 'var(--green-light)' : 'var(--blue-light)', color: p.method === 'CASH' ? 'var(--green)' : 'var(--blue)' }}>
                      {p.method === 'CASH' ? 'Espèces' : p.method || 'Mobile'}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--text3)] text-right">
                    {p.paidAt ? new Date(p.paidAt).toLocaleDateString('fr-FR') : '—'}
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>Élève</th>
                    <th style={{ padding: '6px 10px', textAlign: 'left' }}>Motif</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>Montant</th>
                    <th style={{ padding: '6px 10px', textAlign: 'center' }}>Méthode</th>
                    <th style={{ padding: '6px 10px', textAlign: 'right' }}>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {recentPayments.map((p) => (
                    <tr key={p.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: 'var(--text)' }}>{p.studentName}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--text2)' }}>{p.feePlanName}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{fmtCFA(p.amount)}</td>
                      <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: p.method === 'CASH' ? 'var(--green-light)' : 'var(--blue-light)', color: p.method === 'CASH' ? 'var(--green)' : 'var(--blue)' }}>
                          {p.method === 'CASH' ? 'Espèces' : p.method || 'Mobile'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text3)' }}>
                        {p.paidAt ? new Date(p.paidAt).toLocaleDateString('fr-FR') : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
