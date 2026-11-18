'use client'
import { useState, useEffect, useCallback } from 'react'
import type { SessionUser } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import SectionAPEEStaff from './SectionAPEEStaff'
import SectionPlansStaff from './SectionPlansStaff'
import { fmtCFA } from '@/components/finance/ModalOverlay'
import { getCachedData, putCachedData, getUserSession } from '@/lib/offline/db'
import RecuProvisoireModal from '@/components/finance/RecuProvisoireModal'
import InvoiceDetailsModal from '@/features/finance/InvoiceDetailsModal'
import FinanceCashOpsPanel from '@/features/finance/FinanceCashOpsPanel'
import {
  type FinanceInvoiceItem as InvoiceItem,
  type FinancePagination as Pagination,
} from '@/features/finance/financeShared'
import FinanceStaffDepenseModal from './finance/FinanceStaffDepenseModal'
import FinanceInvoicesTable from './finance/FinanceInvoicesTable'
import { useFinanceStaffPayments } from './finance/useFinanceStaffPayments'
import { btnPrim, btnSec, sSub, sTitle } from './finance/financeStaffStyles'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  sessionUser?: SessionUser | null
  initialTab?: 'invoices' | 'apee' | 'plans' | 'closures'
}

export default function SectionFinanceStaff({ onToast, sessionUser, initialTab = 'invoices' }: Props) {
  const t = useT('staff')
  const [tab, setTab] = useState<'invoices' | 'apee' | 'plans' | 'closures'>(initialTab)
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [detailsInvoice, setDetailsInvoice] = useState<{ id: string; studentName: string; feePlanName: string } | null>(null)
  const [pag, setPag] = useState<Pagination>({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [page, setPage] = useState(1)
  const [schoolInfo, setSchoolInfo] = useState<{ name: string; logoUrl: string | null } | null>(null)
  const [depenseOpen, setDepenseOpen] = useState(false)

  const hasMF = sessionUser?.permissions?.includes('MANAGE_FINANCE') ?? false

  useEffect(() => {
    if (sessionUser?.userId) {
      getUserSession(sessionUser.userId)
        .then(s => {
          if (s?.schoolInfo) setSchoolInfo(s.schoolInfo)
        })
        .catch(() => {})
    }
  }, [sessionUser])

  const fetchInvoices = useCallback(
    async (pg = 1) => {
      setError(null)
      const cacheKey = `staff:finance:invoices:${statusFilter}:${pg}`
      try {
        const cached = await getCachedData<{ invoices: InvoiceItem[]; pagination: Pagination }>(cacheKey)
        if (cached?.data?.invoices) {
          setInvoices(cached.data.invoices)
          setPag(cached.data.pagination)
          setLoading(false)
        }
      } catch {
        /* ignore */
      }

      if (navigator.onLine) {
        try {
          const params = new URLSearchParams({ limit: '20', page: String(pg) })
          if (statusFilter) params.set('status', statusFilter)
          const res = await fetchApi(`/api/v2/finance/invoices?${params}`, { credentials: 'include' })
          const data = await res.json()
          if (!res.ok) throw new Error(data.message || 'Erreur serveur')
          const items = data.data || []
          const pagination = data.pagination ?? { total: 0, page: pg, pages: 1 }
          setInvoices(items)
          setPag(pagination)
          await putCachedData(cacheKey, { invoices: items, pagination })
        } catch (err) {
          if (!invoices.length) {
            setError(err instanceof Error ? err.message : 'Erreur de chargement')
          }
        } finally {
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    },
    [statusFilter, invoices.length]
  )

  useEffect(() => {
    if (tab === 'invoices') {
      setPage(1)
      void fetchInvoices(1)
    }
  }, [tab, fetchInvoices])

  useEffect(() => {
    setPage(1)
    void fetchInvoices(1)
  }, [statusFilter, fetchInvoices])

  const {
    sendingId,
    payingId,
    verifyingId,
    pendingCampayRefs,
    currentRecu,
    setCurrentRecu,
    verifyMobileMoney,
    initiateMobileMoney,
    recordCashPayment,
    sendSmsReminder,
  } = useFinanceStaffPayments({
    invoices,
    setInvoices,
    pag,
    page,
    statusFilter,
    fetchInvoices,
    schoolInfo,
    sessionUser,
    onToast,
  })

  const totalPending = invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE').reduce((s, i) => s + i.amount, 0)
  const totalPartial = invoices.filter(i => i.status === 'PARTIAL').reduce((s, i) => s + i.amount, 0)

  const tabButtonStyle = (active: boolean): React.CSSProperties => ({
    ...btnSec,
    background: active ? 'var(--green-light)' : 'var(--surface)',
    color: active ? 'var(--green)' : 'var(--text2)',
    borderColor: active ? 'var(--green)' : 'var(--border2)',
  })

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-[var(--border)]" style={{ scrollbarWidth: 'none' }}>
        <button style={tabButtonStyle(tab === 'invoices')} className="min-h-[38px] whitespace-nowrap px-3 py-2 text-xs font-bold" onClick={() => setTab('invoices')}>
          {t('finance.tabInvoices') || 'Factures & Paiements'}
        </button>
        {hasMF && (
          <button style={tabButtonStyle(tab === 'plans')} className="min-h-[38px] whitespace-nowrap px-3 py-2 text-xs font-bold" onClick={() => setTab('plans')}>
            {t('finance.tabPlans') || 'Plans de frais'}
          </button>
        )}
        {hasMF && (
          <button style={tabButtonStyle(tab === 'apee')} className="min-h-[38px] whitespace-nowrap px-3 py-2 text-xs font-bold" onClick={() => setTab('apee')}>
            {t('finance.tabAPEE') || 'Transparence APEE'}
          </button>
        )}
        {hasMF && (
          <button style={tabButtonStyle(tab === 'closures')} className="min-h-[38px] whitespace-nowrap px-3 py-2 text-xs font-bold" onClick={() => setTab('closures')}>
            Clôture &amp; Rapprochement
          </button>
        )}
      </div>

      {tab === 'closures' && hasMF ? (
        <FinanceCashOpsPanel canManage={hasMF} invoices={invoices} onReconciled={() => void fetchInvoices(page)} onToast={onToast} />
      ) : tab === 'apee' ? (
        <SectionAPEEStaff onToast={onToast} />
      ) : tab === 'plans' && hasMF ? (
        <SectionPlansStaff
          onToast={onToast}
          onInvoiceCreated={() => {
            setTab('invoices')
            void fetchInvoices(1)
          }}
        />
      ) : tab === 'invoices' ? (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div style={sTitle}>{t('finance.title')}</div>
              <div style={sSub}>{t('finance.subtitle')}</div>
            </div>
            <div className="flex items-center gap-2">
              {hasMF && (
                <button style={btnPrim} className="min-h-[38px] flex-1 sm:flex-initial" onClick={() => setDepenseOpen(true)}>
                  {t('finance.recordExpense')}
                </button>
              )}
              <button style={btnSec} className="min-h-[38px] flex-1 sm:flex-initial" onClick={() => void fetchInvoices(page)}>
                {t('finance.refresh')}
              </button>
            </div>
          </div>

          {!loading && !error && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mb-3.5">
              {[
                { label: t('finance.kpiTotalUnpaid'), val: fmtCFA(totalPending), color: 'var(--red)' },
                { label: t('finance.kpiPartialPayments'), val: fmtCFA(totalPartial), color: 'var(--amber)' },
                { label: '', val: t('finance.kpiResults', { count: pag.total }), color: 'var(--text2)' },
              ].map((k, i) => (
                <div key={i} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '10px 14px' }}>
                  <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                    {k.label}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 900, color: k.color || 'var(--text)' }}>{k.val}</div>
                </div>
              ))}
            </div>
          )}

          <FinanceInvoicesTable
            invoices={invoices}
            pag={pag}
            page={page}
            loading={loading}
            error={error}
            statusFilter={statusFilter}
            hasMF={hasMF}
            payingId={payingId}
            verifyingId={verifyingId}
            sendingId={sendingId}
            pendingCampayRefs={pendingCampayRefs}
            onStatusFilterChange={setStatusFilter}
            onPageChange={nextPage => {
              setPage(nextPage)
              void fetchInvoices(nextPage)
            }}
            onRefresh={pg => void fetchInvoices(pg)}
            onRecordCash={recordCashPayment}
            onInitiateMobileMoney={initiateMobileMoney}
            onVerifyMobileMoney={verifyMobileMoney}
            onSendSmsReminder={sendSmsReminder}
            onOpenDetails={setDetailsInvoice}
          />

          {depenseOpen && <FinanceStaffDepenseModal onClose={() => setDepenseOpen(false)} onToast={onToast} />}
        </>
      ) : null}

      <RecuProvisoireModal data={currentRecu} onClose={() => setCurrentRecu(null)} />
      {detailsInvoice && (
        <InvoiceDetailsModal
          invoiceId={detailsInvoice.id}
          studentName={detailsInvoice.studentName}
          feePlanName={detailsInvoice.feePlanName}
          canManage={hasMF}
          onClose={() => setDetailsInvoice(null)}
          onUpdated={() => void fetchInvoices(page)}
          onToast={onToast}
        />
      )}
    </div>
  )
}
