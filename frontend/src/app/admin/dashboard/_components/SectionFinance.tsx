'use client'

import type React from 'react'
import { useState } from 'react'
import { AlertTriangle, Wallet } from 'lucide-react'
import { useT } from '@/lib/i18n'
import DelegationSupervisionBanner from './DelegationSupervisionBanner'
import FinanceDelegationBanner from '@/components/finance/FinanceDelegationBanner'
import type { AdminSection } from '../_types'
import InvoiceDetailsModal from '@/features/finance/InvoiceDetailsModal'
import FinanceCashOpsPanel from '@/features/finance/FinanceCashOpsPanel'
import { INVOICE_STATUS_STYLES } from '@/features/finance/financeShared'
import { useAdminFinanceData, type FinanceAdminTab } from './finance/useAdminFinanceData'
import FinanceSupervisionTab from './finance/FinanceSupervisionTab'
import FinanceFeePlansTab from './finance/FinanceFeePlansTab'
import FinanceInvoicesTab from './finance/FinanceInvoicesTab'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onNav?: (section: AdminSection) => void
}

void INVOICE_STATUS_STYLES

export default function SectionFinance({ onToast, onNav }: Props) {
  const [detailsInvoice, setDetailsInvoice] = useState<{ id: string; studentName: string; feePlanName: string } | null>(null)
  const t = useT('finance')
  const fin = useAdminFinanceData(onToast)

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div className="mb-3 md:mb-4">
        <div className="text-[15px] md:text-[17px]" style={sTitle}>
          {t('title')} — Pilotage &amp; Supervision Financière
        </div>
        <div className="text-[11px] md:text-[12px]" style={sSub}>{t('subtitle')}</div>
      </div>

      <DelegationSupervisionBanner actorTitle="Intendant / Économe" domainLabel="Finance & Tarifs" onNav={onNav} />
      <FinanceDelegationBanner onNav={onNav} />

      <div className="mb-3 p-2.5 md:p-3 rounded-lg md:rounded-xl border border-success/20 bg-success/5 text-xs text-[var(--text)] flex items-center justify-between gap-2.5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-success/15 text-success flex-shrink-0">
            <Wallet size={14} />
          </div>
          <div>
            <p className="font-bold text-[11.5px] md:text-[12px]">Supervision Directoriale (Lecture Seule)</p>
            <p className="text-[10.5px] md:text-[11px] text-[var(--text2)]">
              La tenue de caisse, l&apos;émission des factures et l&apos;encaissement quotidien sont opérés par l&apos;Intendant. En tant que Directeur, vous suivez le taux de recouvrement, le volume des impayés et l&apos;historique des écritures.
            </p>
          </div>
        </div>
      </div>

      <div className="gap-1 mb-3 md:mb-4 max-w-full overflow-x-auto no-scrollbar" style={{ display: 'flex', background: 'var(--bg2)', padding: 3, borderRadius: 10, width: 'fit-content' }}>
        {(['supervision', 'plans', 'invoices', 'closures'] as FinanceAdminTab[]).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => fin.setTab(tabKey)}
            className="min-h-[36px] px-2.5 md:px-3 py-1 md:py-1.5 text-[11.5px] md:text-[13px] whitespace-nowrap flex-shrink-0"
            style={{
              borderRadius: 7,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: 'none',
              background: fin.tab === tabKey ? 'var(--surface)' : 'transparent',
              color: fin.tab === tabKey ? 'var(--text)' : 'var(--text3)',
              boxShadow: fin.tab === tabKey ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.12s',
            }}
          >
            {tabKey === 'supervision'
              ? t('tabs.supervision')
              : tabKey === 'plans'
                ? t('tabs.plans')
                : tabKey === 'invoices'
                  ? t('tabs.invoices')
                  : 'Clôtures & Rapprochement'}
          </button>
        ))}
      </div>

      {fin.loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
          <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!fin.loading && fin.error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={15} strokeWidth={2} />
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, fontSize: 13 }}>{fin.error}</span>
          <button
            onClick={() => (fin.tab === 'plans' ? fin.fetchPlans() : fin.fetchInvoices(fin.page))}
            style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }}
          >
            {t('actions.retry')}
          </button>
        </div>
      )}

      {!fin.loading && !fin.error && fin.tab === 'supervision' && (
        <FinanceSupervisionTab
          recoveryRate={fin.recoveryRate}
          totalAmount={fin.totalAmount}
          paidAmount={fin.paidAmount}
          overdueCount={fin.overdueCount}
          recentPayments={fin.recentPayments}
          onGoToInvoices={() => fin.setTab('invoices')}
        />
      )}

      {!fin.loading && !fin.error && fin.tab === 'plans' && (
        <FinanceFeePlansTab
          plans={fin.plans}
          validatingPlanId={fin.validatingPlanId}
          onValidatePlan={fin.handleValidatePlan}
        />
      )}

      {!fin.loading && !fin.error && fin.tab === 'invoices' && (
        <FinanceInvoicesTab
          invoices={fin.invoices}
          pag={fin.pag}
          page={fin.page}
          setPage={fin.setPage}
          invStatus={fin.invStatus}
          onStatusChange={val => { fin.setInvStatus(val); fin.setPage(1) }}
          totalAmount={fin.totalAmount}
          paidAmount={fin.paidAmount}
          pendingCount={fin.pendingCount}
          overdueCount={fin.overdueCount}
          onSelectDetails={setDetailsInvoice}
        />
      )}

      {!fin.loading && !fin.error && fin.tab === 'closures' && (
        <FinanceCashOpsPanel
          canManage={true}
          invoices={fin.invoices}
          onReconciled={() => void fin.fetchInvoices(fin.page)}
          onToast={onToast}
        />
      )}

      {detailsInvoice && (
        <InvoiceDetailsModal
          invoiceId={detailsInvoice.id}
          studentName={detailsInvoice.studentName}
          feePlanName={detailsInvoice.feePlanName}
          canManage={true}
          onClose={() => setDetailsInvoice(null)}
          onUpdated={() => void fin.fetchInvoices(fin.page)}
          onToast={onToast}
        />
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
