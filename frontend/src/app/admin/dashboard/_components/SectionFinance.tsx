'use client'

import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Wallet, CheckCircle2, Loader2, Circle, Clock, DollarSign, Smartphone } from 'lucide-react'
import DelegationSupervisionBanner from './DelegationSupervisionBanner'
import FinanceDelegationBanner from '@/components/finance/FinanceDelegationBanner'
import { fmtCFA } from '@/components/finance/ModalOverlay'
import type { AdminSection } from '../_types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onNav?: (section: AdminSection) => void
}

interface FeePlan {
  id: string
  name: string
  amount: number
  currency: string
  feeType: string
  level: string | null
  description: string | null
  isRefundable: boolean
  dueDate: string | null
  createdAt: string
}

interface Payment {
  id: string
  amount: number
  status: string
  paidAt: string | null
  method: string
}

interface InvoiceItem {
  id: string
  amount: number
  currency: string
  status: string
  dueDate: string | null
  createdAt: string
  description: string | null
  student: { id: string; firstName: string; lastName: string }
  feePlan: { id: string; name: string; feeType: string } | null
  payments: Payment[]
}

interface Pagination {
  total: number
  page: number
  pages: number
}

export default function SectionFinance({ onToast, onNav }: Props) {
  const [tab, setTab] = useState<'supervision' | 'plans' | 'invoices'>('supervision')
  const [plans, setPlans] = useState<FeePlan[]>([])
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [pag, setPag] = useState<Pagination>({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [invStatus, setInvStatus] = useState('')
  const [page, setPage] = useState(1)

  const t = useT('finance')

  const getInvStatus = (status: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      PENDING: { bg: 'var(--amber-light)', color: 'var(--amber)', label: t('invoice_status.PENDING') },
      PAID: { bg: 'var(--green-light)', color: 'var(--green)', label: t('invoice_status.PAID') },
      OVERDUE: { bg: 'var(--red-light)', color: 'var(--red)', label: t('invoice_status.OVERDUE') },
      CANCELLED: { bg: 'var(--bg2)', color: 'var(--text2)', label: t('invoice_status.CANCELLED') },
      PARTIAL: { bg: 'var(--blue-light)', color: 'var(--blue)', label: t('invoice_status.PARTIAL') },
    }
    return styles[status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: status }
  }

  const FEE_TYPE_LABEL: Record<string, string> = {
    TUITION: t('fee_type.TUITION'),
    REGISTRATION: t('fee_type.REGISTRATION'),
    EXAM: t('fee_type.EXAM'),
    UNIFORM: t('fee_type.UNIFORM'),
    TRANSPORT: t('fee_type.TRANSPORT'),
    CAUTION: t('fee_type.CAUTION'),
    OTHER: t('fee_type.OTHER'),
  }

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await fetchApi('/api/v2/finance/fee-plans', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.server_error'))
      setPlans(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic_error'))
    } finally {
      setLoading(false)
    }
  }, [t])

  const fetchInvoices = useCallback(
    async (pg = page) => {
      try {
        setLoading(true)
        setError(null)
        const params = new URLSearchParams({ page: String(pg), limit: '20' })
        if (invStatus) params.set('status', invStatus)
        const res = await fetchApi(`/api/v2/finance/invoices?${params}`, { credentials: 'include' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || t('errors.server_error'))
        setInvoices(data.data || [])
        if (data.pagination) setPag(data.pagination)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errors.generic_error'))
      } finally {
        setLoading(false)
      }
    },
    [invStatus, page, t]
  )

  useEffect(() => {
    if (tab === 'plans') {
      fetchPlans()
    } else {
      fetchInvoices(page)
    }
  }, [tab, page, invStatus, fetchPlans, fetchInvoices])

  useEffect(() => {
    const onChanged = () => {
      if (tab === 'plans') fetchPlans()
      else fetchInvoices(page)
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchPlans, fetchInvoices, tab, page])

  // KPIs calculés depuis les factures
  const totalAmount = invoices.reduce((s, i) => s + i.amount, 0)
  const paidAmount = invoices.filter((i) => i.status === 'PAID').reduce((s, i) => s + i.amount, 0)
  const pendingCount = invoices.filter((i) => i.status === 'PENDING').length
  const overdueCount = invoices.filter((i) => i.status === 'OVERDUE').length
  const recoveryRate = totalAmount > 0 ? Math.round((paidAmount / totalAmount) * 100) : 0

  // Paiements récents pour le fil d'audit
  const recentPayments = invoices
    .flatMap((inv) =>
      (inv.payments || []).map((p) => ({
        ...p,
        studentName: `${inv.student.firstName} ${inv.student.lastName}`,
        feePlanName: inv.feePlan?.name ?? 'Scolarité',
      }))
    )
    .sort((a, b) => new Date(b.paidAt || 0).getTime() - new Date(a.paidAt || 0).getTime())
    .slice(0, 10)

  return (
    <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div className="mb-3 md:mb-4">
        <div className="text-[15px] md:text-[17px]" style={sTitle}>
          {t('title')} — Pilotage & Supervision Financière
        </div>
        <div className="text-[11px] md:text-[12px]" style={sSub}>
          {t('subtitle')}
        </div>
      </div>

      <DelegationSupervisionBanner actorTitle="Intendant / Économe" domainLabel="Finance & Tarifs" onNav={onNav} />
      <FinanceDelegationBanner onNav={onNav} />

      {/* Directorship Governance Notice */}
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

      {/* Tabs */}
      <div
        className="gap-1 mb-3 md:mb-4 max-w-full overflow-x-auto no-scrollbar"
        style={{ display: 'flex', background: 'var(--bg2)', padding: 3, borderRadius: 10, width: 'fit-content' }}
      >
        {(['supervision', 'plans', 'invoices'] as const).map((tabKey) => (
          <button
            key={tabKey}
            onClick={() => setTab(tabKey)}
            className="px-2.5 md:px-3 py-1 md:py-1.5 text-[11.5px] md:text-[13px] whitespace-nowrap flex-shrink-0"
            style={{
              borderRadius: 7,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit',
              border: 'none',
              background: tab === tabKey ? 'var(--surface)' : 'transparent',
               color: tab === tabKey ? 'var(--text)' : 'var(--text3)',
              boxShadow: tab === tabKey ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
              transition: 'all 0.12s',
            }}
          >
            {tabKey === 'supervision' ? t('tabs.supervision') : tabKey === 'plans' ? t('tabs.plans') : t('tabs.invoices')}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
          <div
            style={{
              width: 28,
              height: 28,
              border: '2.5px solid var(--border)',
              borderTopColor: 'var(--green)',
              borderRadius: '50%',
              animation: 'edu-spin 0.7s linear infinite',
            }}
          />
        </div>
      )}

      {!loading && error && (
        <div
          style={{
            background: 'var(--red-light)',
            borderRadius: 10,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <AlertTriangle size={15} strokeWidth={2} />
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, fontSize: 13 }}>{error}</span>
          <button
            onClick={() => (tab === 'plans' ? fetchPlans() : fetchInvoices(page))}
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
            {t('actions.retry')}
          </button>
        </div>
      )}

      {/* Vue Supervision */}
      {!loading && !error && tab === 'supervision' && (
        <div className="flex flex-col gap-3 md:gap-4">
          {/* Métriques clés */}
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

          {/* File d'attente d'arbitrage / Décisions */}
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
                <button
                  onClick={() => setTab('invoices')}
                  className="text-[11px] font-bold underline hover:no-underline ml-2" style={{ color: 'var(--amber)' }}
                >
                  Examiner les factures
                </button>
              </div>
            )}
          </div>

          {/* Fil d'audit : Dernières opérations financières enregistrées */}
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
              <div style={{ overflowX: 'auto' }}>
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
                        <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>
                          {fmtCFA(p.amount)}
                        </td>
                        <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 8,
                              fontSize: 11,
                              fontWeight: 600,
                              background: p.method === 'CASH' ? 'var(--green-light)' : 'var(--blue-light)',
                              color: p.method === 'CASH' ? 'var(--green)' : 'var(--blue)',
                            }}
                          >
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
            )}
          </div>
        </div>
      )}

      {/* Plans de frais (Lecture seule) */}
      {!loading && !error && tab === 'plans' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] md:text-[14px] font-bold text-[var(--text)]">{t('tabs.plans')}</div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid var(--amber)' }}>
              Gestion déléguée à l&apos;Intendant (Lecture seule)
            </span>
          </div>

          {plans.length === 0 ? (
            <div
              className="px-4 py-8 md:px-6 md:py-10"
              style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <Wallet size={32} strokeWidth={1.5} />
              </div>
              <div className="text-[14px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>
                {t('empty_states.no_plans_title')}
              </div>
              <div className="text-xs md:text-[13px] mb-3" style={{ color: 'var(--text3)' }}>
                {t('empty_states.no_plans_description')}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="p-3 md:p-3.5 rounded-xl border border-[var(--border)] shadow-xs md:shadow-none"
                  style={{ background: 'var(--surface)' }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div className="text-[13px] md:text-[14.5px]" style={{ fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
                      {plan.name}
                    </div>
                    <span
                      className="text-[10px] md:text-[11px]"
                      style={{
                        background: 'var(--blue-light)',
                        color: 'var(--blue)',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginLeft: 6,
                      }}
                    >
                      {FEE_TYPE_LABEL[plan.feeType] ?? plan.feeType}
                    </span>
                  </div>
                  <div className="text-[16px] md:text-[20px]" style={{ fontWeight: 900, color: 'var(--green)', marginBottom: 4 }}>
                    {fmtCFA(plan.amount)}
                  </div>
                  {plan.description && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.4 }}>{plan.description}</div>
                  )}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8 }}>
                    {plan.level && (
                      <span
                        className="text-[10px] md:text-[11px]"
                        style={{ background: 'var(--bg2)', color: 'var(--text2)', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}
                      >
                        {t('badges.level').replace('{level}', plan.level)}
                      </span>
                    )}
                    {plan.isRefundable && (
                      <span
                        className="text-[10px] md:text-[11px]"
                        style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}
                      >
                        {t('badges.refundable')}
                      </span>
                    )}
                    {plan.dueDate && (
                      <span
                        className="text-[10px] md:text-[11px]"
                        style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}
                      >
                        {t('badges.due_date').replace(
                          '{date}',
                          new Date(plan.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                        )}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Factures (Lecture seule) */}
      {!loading && !error && tab === 'invoices' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] md:text-[14px] font-bold text-[var(--text)]">{t('tabs.invoices')}</div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-lg" style={{ background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid var(--amber)' }}>
              Facturation gérée par l&apos;Intendant (Lecture seule)
            </span>
          </div>

          {/* KPIs factures */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3" style={{ marginBottom: 14 }}>
            {[
              { label: t('kpi.total_billed'), val: fmtCFA(totalAmount), bg: 'var(--blue-light)' },
              { label: t('kpi.total_collected'), val: fmtCFA(paidAmount), bg: 'var(--green-light)' },
              { label: t('kpi.pending'), val: String(pendingCount), bg: 'var(--amber-light)' },
              { label: t('kpi.overdue'), val: String(overdueCount), bg: 'var(--red-light)' },
            ].map((k, i) => (
              <div
                key={i}
                className="p-2.5 md:px-3.5 md:py-3 rounded-xl border border-[var(--border)] shadow-xs md:shadow-none"
                style={{ background: 'var(--surface)' }}
              >
                <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{k.label}</div>
                <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>{k.val}</div>
              </div>
            ))}
          </div>

          {/* Filtre de statut */}
          <div className="flex items-center gap-2 mb-3">
            <select
              value={invStatus}
              onChange={(e) => {
                setInvStatus(e.target.value)
                setPage(1)
              }}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                color: 'var(--text)',
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <option value="">Tous les statuts ({pag.total})</option>
              <option value="PENDING">En attente</option>
              <option value="PAID">Payée</option>
              <option value="OVERDUE">En retard</option>
              <option value="PARTIAL">Partielle</option>
            </select>
          </div>

          {/* Tableau factures */}
          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text2)' }}>Élève</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text2)' }}>Plan de frais</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text2)', textAlign: 'right' }}>Montant</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text2)', textAlign: 'center' }}>Statut</th>
                  <th style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text2)', textAlign: 'right' }}>Échéance</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => {
                  const st = getInvStatus(inv.status)
                  return (
                    <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text)' }}>
                        {inv.student.firstName} {inv.student.lastName}
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text2)' }}>{inv.feePlan?.name ?? '—'}</td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: 'var(--text)' }}>
                        {fmtCFA(inv.amount)}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                        <span
                          style={{
                            padding: '3px 8px',
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
                      <td style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text3)' }}>
                        {inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('fr-FR') : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pag.pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
              >
                Précédent
              </button>
              <span style={{ padding: '5px 10px', fontSize: 12, fontWeight: 700 }}>
                {page} / {pag.pages}
              </span>
              <button
                disabled={page >= pag.pages}
                onClick={() => setPage((p) => Math.min(pag.pages, p + 1))}
                style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', cursor: 'pointer' }}
              >
                Suivant
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
