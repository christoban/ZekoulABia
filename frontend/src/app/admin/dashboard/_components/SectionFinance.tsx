'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Wallet, Pencil, CheckCircle2, Loader2, Circle } from 'lucide-react'
import DelegationSupervisionBanner from './DelegationSupervisionBanner'

import type { AdminSection } from '../_types'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onNav?: (section: AdminSection) => void
}

interface FeePlan {
  id: string; name: string; amount: number; currency: string
  feeType: string; level: string | null; description: string | null
  isRefundable: boolean; dueDate: string | null; createdAt: string
}

interface Payment { id: string; amount: number; status: string; paidAt: string | null }
interface InvoiceItem {
  id: string; amount: number; currency: string; status: string
  dueDate: string | null; createdAt: string; description: string | null
  student: { id: string; firstName: string; lastName: string }
  feePlan: { id: string; name: string; feeType: string } | null
  payments: Payment[]
}

interface Pagination { total: number; page: number; pages: number }

function fmtCFA(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

const FEE_TYPES = ['TUITION','REGISTRATION','EXAM','UNIFORM','TRANSPORT','CAUTION','OTHER']

const EMPTY_PLAN = { name: '', amount: '', feeType: 'TUITION', description: '', dueDate: '', isRefundable: false, loading: false, error: '' }
const EMPTY_MOD_PLAN = { open: false, planId: '', name: '', amount: '', feeType: '', description: '', dueDate: '', loading: false, error: '' }
const EMPTY_BULK = { open: false, planId: '', planName: '', academicYearId: '', loading: false, error: '', years: [] as { id: string; name: string }[] }
const EMPTY_INVOICE = { studentId: '', feePlanId: '', description: '', loading: false, error: '' }

export default function SectionFinance({ onToast, onNav }: Props) {
  const [tab, setTab] = useState<'supervision' | 'plans' | 'invoices'>('supervision')
  const [plans, setPlans]       = useState<FeePlan[]>([])
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [pag, setPag]           = useState<Pagination>({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [invStatus, setInvStatus] = useState('')
  const [page, setPage]         = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [planForm, setPlanForm]     = useState(EMPTY_PLAN)
  const [modPlan, setModPlan]       = useState(EMPTY_MOD_PLAN)
  const [bulkForm, setBulkForm]         = useState(EMPTY_BULK)
  const [invoiceOpen, setInvoiceOpen]   = useState(false)
  const [invoiceForm, setInvoiceForm]   = useState(EMPTY_INVOICE)
  const [invStudents, setInvStudents]   = useState<{ id: string; firstName: string; lastName: string; studentProfile?: { class?: { name: string } } | null }[]>([])
  const [invPlans, setInvPlans]         = useState<{ id: string; name: string; amount: number }[]>([])
  const [invModalLoading, setInvModalLoading] = useState(false)
  const t = useT('finance')
  const getInvStatus = (status: string) => {
    const styles: Record<string, { bg: string; color: string; label: string }> = {
      PENDING:    { bg: 'var(--amber-light)', color: 'var(--amber)', label: t('invoice_status.PENDING') },
      PAID:       { bg: 'var(--green-light)', color: 'var(--green)', label: t('invoice_status.PAID') },
      OVERDUE:    { bg: 'var(--red-light)', color: 'var(--red)', label: t('invoice_status.OVERDUE') },
      CANCELLED:  { bg: 'var(--bg2)', color: 'var(--text2)', label: t('invoice_status.CANCELLED') },
      PARTIAL:    { bg: 'var(--blue-light)', color: 'var(--blue)', label: t('invoice_status.PARTIAL') },
    }
    return styles[status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: status }
  }
  const FEE_TYPE_LABEL: Record<string, string> = {
    TUITION:      t('fee_type.TUITION'),
    REGISTRATION: t('fee_type.REGISTRATION'),
    EXAM:         t('fee_type.EXAM'),
    UNIFORM:      t('fee_type.UNIFORM'),
    TRANSPORT:    t('fee_type.TRANSPORT'),
    CAUTION:      t('fee_type.CAUTION'),
    OTHER:        t('fee_type.OTHER'),
  }

  const fetchPlans = useCallback(async () => {
    try {
      setLoading(true); setError(null)
      const res = await fetchApi('/api/v2/finance/fee-plans', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.server_error'))
      setPlans(data.data || [])
    } catch (err) { setError(err instanceof Error ? err.message : t('errors.generic_error')) }
    finally { setLoading(false) }
  }, [])

  const fetchInvoices = useCallback(async (pg = page) => {
    try {
      setLoading(true); setError(null)
      const params = new URLSearchParams({ limit: '20', page: String(pg) })
      if (invStatus) params.set('status', invStatus)
      const res = await fetchApi(`/api/v2/finance/invoices?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.server_error'))
      setInvoices(data.data || [])
      setPag(data.pagination ?? { total: 0, page: pg, pages: 1 })
    } catch (err) { setError(err instanceof Error ? err.message : t('errors.generic_error')) }
    finally { setLoading(false) }
  }, [page, invStatus])

  useEffect(() => {
    if (tab === 'supervision') {
      fetchPlans()
      fetchInvoices(1)
    } else if (tab === 'plans') {
      fetchPlans()
    } else {
      fetchInvoices(1)
    }
  }, [tab])  // eslint-disable-line react-hooks/exhaustive-deps

  // Rafraîchissement temps réel quand l'assistant IA agit sur les plans/factures/paiements.
  useEffect(() => {
    const onChanged = (e: Event) => {
      const entity = (e as CustomEvent<{ entity?: string }>).detail?.entity
      if (entity === 'feePlan') fetchPlans()
      if ((entity === 'invoice' || entity === 'payment') && tab !== 'plans') fetchInvoices(page)
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchPlans, fetchInvoices, tab, page])

  const fetchYearsForBulk = async () => {
    try {
      const res = await fetchApi('/api/v2/academic-years', { credentials: 'include' })
      const d = await res.json()
      return (d.data || []) as { id: string; name: string }[]
    } catch { return [] }
  }

  // ── Créer plan ──────────────────────────────────────────────────────────
  const submitCreatePlan = async () => {
    if (!planForm.name.trim() || !planForm.amount) { setPlanForm(f => ({ ...f, error: t('errors.name_and_amount_required') })); return }
    setPlanForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/finance/fee-plans', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: planForm.name.trim(),
          amount: parseFloat(planForm.amount),
          feeType: planForm.feeType,
          description: planForm.description.trim() || undefined,
          dueDate: planForm.dueDate || undefined,
          isRefundable: planForm.isRefundable,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.generic_error'))
      onToast(t('toasts.plan_created').replace('{name}', planForm.name), 'success')
      setCreateOpen(false); setPlanForm(EMPTY_PLAN); fetchPlans()
    } catch (err) {
      setPlanForm(f => ({ ...f, error: err instanceof Error ? err.message : t('errors.generic_error'), loading: false }))
    }
  }

  // ── Modifier plan (désactivé — route backend non disponible) ───────────
  const openModPlan = (_plan: FeePlan) => {
    onToast(t('toasts.feature_coming_soon'), 'info')
  }

  const submitModPlan = async () => {
    if (!modPlan.name.trim() || !modPlan.amount) { setModPlan(f => ({ ...f, error: t('errors.name_and_amount_required') })); return }
    setModPlan(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi(`/api/v2/finance/fee-plans/${modPlan.planId}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modPlan.name.trim(), amount: parseFloat(modPlan.amount), feeType: modPlan.feeType, description: modPlan.description || undefined, dueDate: modPlan.dueDate || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.generic_error'))
      onToast(t('toasts.plan_modified'), 'success')
      setModPlan(EMPTY_MOD_PLAN); fetchPlans()
    } catch (err) {
      setModPlan(f => ({ ...f, error: err instanceof Error ? err.message : t('errors.generic_error'), loading: false }))
    }
  }

  // ── Générer factures en masse ────────────────────────────────────────────
  const openBulk = async (plan: FeePlan) => {
    const years = await fetchYearsForBulk()
    setBulkForm({ open: true, planId: plan.id, planName: plan.name, academicYearId: years[0]?.id ?? '', loading: false, error: '', years })
  }

  const submitBulk = async () => {
    if (!bulkForm.academicYearId) { setBulkForm(f => ({ ...f, error: t('errors.select_year') })); return }
    setBulkForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/finance/invoices/bulk', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feePlanId: bulkForm.planId, academicYearId: bulkForm.academicYearId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || t('errors.generic_error'))
      onToast(t('toasts.invoices_generated').replace('{count}', String(data.count ?? 0)), 'success')
      setBulkForm(EMPTY_BULK); setTab('invoices'); fetchInvoices(1)
    } catch (err) {
      setBulkForm(f => ({ ...f, error: err instanceof Error ? err.message : t('errors.generic_error'), loading: false }))
    }
  }

  // ── Créer facture individuelle ───────────────────────────────────────────
  const openInvoiceModal = async () => {
    setInvoiceOpen(true); setInvoiceForm(EMPTY_INVOICE); setInvModalLoading(true)
    try {
      const [sRes, pRes] = await Promise.all([
        fetchApi('/api/v2/users?role=STUDENT', { credentials: 'include' }),
        fetchApi('/api/v2/finance/fee-plans', { credentials: 'include' }),
      ])
      const [sData, pData] = await Promise.all([sRes.json(), pRes.json()])
      setInvStudents(sData.data || [])
      setInvPlans(pData.data || [])
    } catch {}
    finally { setInvModalLoading(false) }
  }

  const submitInvoice = async () => {
    if (!invoiceForm.studentId || !invoiceForm.feePlanId) {
      setInvoiceForm(f => ({ ...f, error: t('errors.select_student_and_plan') })); return
    }
    setInvoiceForm(f => ({ ...f, loading: true, error: '' }))
    try {
      const body: Record<string, string> = { studentId: invoiceForm.studentId, feePlanId: invoiceForm.feePlanId }
      if (invoiceForm.description.trim()) body.description = invoiceForm.description.trim()
      const res = await fetchApi('/api/v2/finance/invoices', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        const code = data.code || ''
        let errMsg = data.message || t('errors.server_error')
        if (res.status === 409)
          errMsg = t('errors.payment_in_progress')
        else if (res.status === 422 && code === 'SEUIL_LEGAL_DEPASSE')
          errMsg = t('errors.legal_threshold_exceeded')
        else if (res.status === 403 && code === 'SEPARATION_ORDONNATEUR')
          errMsg = t('errors.separation_ordinator')
        setInvoiceForm(f => ({ ...f, error: errMsg, loading: false })); return
      }
      onToast(t('toasts.invoice_created'), 'success')
      setInvoiceOpen(false); setInvoiceForm(EMPTY_INVOICE)
      if (tab === 'invoices') fetchInvoices(1)
    } catch (err) {
      setInvoiceForm(f => ({ ...f, error: err instanceof Error ? err.message : t('errors.generic_error'), loading: false }))
    }
  }

  // KPIs from invoices data
  const totalAmount    = invoices.reduce((s, i) => s + i.amount, 0)
  const paidAmount     = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0)
  const pendingCount   = invoices.filter(i => i.status === 'PENDING').length
  const overdueCount   = invoices.filter(i => i.status === 'OVERDUE').length

  return (
    <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div className="mb-3 md:mb-4">
        <div className="text-[15px] md:text-[17px]" style={sTitle}>{t('title')} — Pilotage Financier</div>
        <div className="text-[11px] md:text-[12px]" style={sSub}>{t('subtitle')}</div>
      </div>

      <DelegationSupervisionBanner actorTitle="Intendant / Économe" domainLabel="Finance & Tarifs" onNav={onNav} />

      {/* RACI Directorship Governance Notice */}
      <div className="mb-3 p-2.5 md:p-3 rounded-lg md:rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-xs text-[var(--text)] flex items-center justify-between gap-2.5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-md bg-emerald-500/15 text-emerald-600 flex-shrink-0">
            <Wallet size={14} />
          </div>
          <div>
            <p className="font-bold text-[11.5px] md:text-[12px]">Supervision Financière Directoriale</p>
            <p className="text-[10.5px] md:text-[11px] text-[var(--text2)]">La collecte quotidienne de scolarité est gérée par l’Intendant. En tant que Directeur, vous suivez le taux de recouvrement, approuvez les exonérations et validez les tarifs.</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="gap-1 mb-3 md:mb-4" style={{ display: 'flex', background: 'var(--bg2)', padding: 3, borderRadius: 10, width: 'fit-content' }}>
        {(['supervision', 'plans', 'invoices'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)}
            className="px-2.5 md:px-3 py-1 md:py-1.5 text-[11.5px] md:text-[13px]"
            style={{ borderRadius: 7, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: 'none', background: tab === tabKey ? 'white' : 'transparent', color: tab === tabKey ? 'var(--text)' : 'var(--text3)', boxShadow: tab === tabKey ? '0 1px 4px rgba(0,0,0,0.08)' : 'none', transition: 'all 0.12s' }}>
            {tabKey === 'supervision' ? t('tabs.supervision') : tabKey === 'plans' ? t('tabs.plans') : t('tabs.invoices')}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
          <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={15} strokeWidth={2} />
          <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, fontSize: 13 }}>{error}</span>
          <button onClick={() => tab === 'plans' ? fetchPlans() : fetchInvoices(page)}
            style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }}>
            {t('actions.retry')}
          </button>
        </div>
      )}

      {/* Vue Supervision */}
      {!loading && !error && tab === 'supervision' && (
        <div className="flex flex-col gap-3 md:gap-4">
          {/* File d'attente d'arbitrage / Décisions */}
          <div className="p-3 md:p-3.5 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle2 className="w-4 h-4 text-amber-600" />
              <div className="text-[12.5px] md:text-[13.5px] font-bold text-[var(--text)]">{t('supervision_queue.title')}</div>
            </div>
            {overdueCount === 0 && plans.length > 0 ? (
              <div className="text-xs font-semibold text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{t('supervision_queue.all_clear')}</span>
              </div>
            ) : (
              <div className="flex flex-col md:flex-row gap-2.5">
                {overdueCount > 0 && (
                  <div className="flex-1 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800">
                      {t('supervision_queue.overdue_invoices').replace('{count}', String(overdueCount))}
                    </span>
                    <button onClick={() => setTab('invoices')} className="text-[11px] font-bold text-amber-900 underline hover:no-underline ml-2">
                      {t('supervision_queue.go_to_invoices')}
                    </button>
                  </div>
                )}
                <div className="flex-1 bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-800">
                    {t('supervision_queue.pending_plans').replace('{count}', String(plans.length))}
                  </span>
                  <button onClick={() => setTab('plans')} className="text-[11px] font-bold text-blue-900 underline hover:no-underline ml-2">
                    {t('supervision_queue.go_to_plans')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* KPIs factures */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3">
            {[
              { icon: <Wallet size={15} strokeWidth={2} />, label: t('kpi.total_billed'),        val: fmtCFA(totalAmount),   bg: 'var(--blue-light)' },
              { icon: <CheckCircle2 size={15} strokeWidth={2} />, label: t('kpi.total_collected'),      val: fmtCFA(paidAmount),    bg: 'var(--green-light)' },
              { icon: <Loader2 size={15} strokeWidth={2} />, label: t('kpi.pending'),             val: String(pendingCount),  bg: 'var(--amber-light)' },
              { icon: <Circle size={10} fill="var(--red)" stroke="none" />, label: t('kpi.overdue'),             val: String(overdueCount),  bg: 'var(--red-light)' },
            ].map((k, i) => (
              <div key={i} className="p-2.5 md:px-3.5 md:py-3 rounded-xl border border-[var(--border)] shadow-xs md:shadow-none" style={{ background: 'var(--surface)' }}>
                <div className="w-7 h-7 md:w-8 md:h-8" style={{ borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 6 }}>{k.icon}</div>
                <div className="text-[15px] md:text-[18px] font-black" style={{ color: 'var(--text)' }}>{k.val}</div>
                <div className="text-[10.5px] md:text-[11.5px]" style={{ color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Plans de frais */}
      {!loading && !error && tab === 'plans' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] md:text-[14px] font-bold text-[var(--text)]">{t('tabs.plans')}</div>
            <button style={btnPrim} onClick={() => setCreateOpen(true)}>{t('actions.new_plan')}</button>
          </div>

          {plans.length === 0 ? (
            <div className="px-4 py-8 md:px-6 md:py-10" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
                <Wallet size={32} strokeWidth={1.5} />
              </div>
              <div className="text-[14px] md:text-[16px]" style={{ fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('empty_states.no_plans_title')}</div>
              <div className="text-xs md:text-[13px] mb-3" style={{ color: 'var(--text3)' }}>
                {t('empty_states.no_plans_description')}
              </div>
              <button className="w-full md:w-auto justify-center text-xs md:text-xs px-3 py-1.5" style={{ ...btnPrim, display: 'inline-flex', alignItems: 'center' }} onClick={() => setCreateOpen(true)}>{t('empty_states.no_plans_action')}</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {plans.map((plan) => (
                <div key={plan.id} className="p-3 md:p-3.5 rounded-xl border border-[var(--border)] shadow-xs md:shadow-none" style={{ background: 'var(--surface)', transition: 'all 0.15s' }}
                  onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-1px)', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' })}
                  onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div className="text-[13px] md:text-[14.5px]" style={{ fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
                      {plan.name}
                    </div>
                    <span className="text-[10px] md:text-[11px]" style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '2px 8px', borderRadius: 12, fontWeight: 700, flexShrink: 0, marginLeft: 6 }}>
                      {FEE_TYPE_LABEL[plan.feeType] ?? plan.feeType}
                    </span>
                  </div>
                  <div className="text-[16px] md:text-[20px]" style={{ fontWeight: 900, color: 'var(--green)', marginBottom: 4 }}>
                    {fmtCFA(plan.amount)}
                  </div>
                  {plan.description && (
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8, lineHeight: 1.4 }}>{plan.description}</div>
                  )}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
                    {plan.level && (
                      <span className="text-[10px] md:text-[11px]" style={{ background: 'var(--bg2)', color: 'var(--text2)', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>
                        {t('badges.level').replace('{level}', plan.level)}
                      </span>
                    )}
                    {plan.isRefundable && (
                      <span className="text-[10px] md:text-[11px]" style={{ background: 'var(--green-light)', color: 'var(--green)', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>
                        {t('badges.refundable')}
                      </span>
                    )}
                    {plan.dueDate && (
                      <span className="text-[10px] md:text-[11px]" style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '2px 6px', borderRadius: 6, fontWeight: 600 }}>
                        {t('badges.due_date').replace('{date}', new Date(plan.dueDate).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }))}
                      </span>
                    )}
                  </div>
                  <div style={{ paddingTop: 8, borderTop: '1px solid var(--border)', display: 'flex', gap: 6 }}>
                    <button style={btnSecSm} onClick={() => openBulk(plan)}>{t('actions.generate_invoices')}</button>
                    <button style={btnSecSm} onClick={() => openModPlan(plan)}><Pencil size={12} strokeWidth={2} /></button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Factures */}
      {!loading && !error && tab === 'invoices' && (
        <>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[13px] md:text-[14px] font-bold text-[var(--text)]">{t('tabs.invoices')}</div>
            <button style={{ padding: '6px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--green)', border: '1.5px solid rgba(5,150,105,0.35)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={openInvoiceModal}>{t('actions.create_invoice')}</button>
          </div>
          {/* KPIs factures (sur la page courante) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 md:gap-3" style={{ marginBottom: 14 }}>
            {[
              { icon: <Wallet size={15} strokeWidth={2} />, label: t('kpi.total_billed'),        val: fmtCFA(totalAmount),   bg: 'var(--blue-light)' },
              { icon: <CheckCircle2 size={15} strokeWidth={2} />, label: t('kpi.total_collected'),      val: fmtCFA(paidAmount),    bg: 'var(--green-light)' },
              { icon: <Loader2 size={15} strokeWidth={2} />, label: t('kpi.pending'),             val: String(pendingCount),  bg: 'var(--amber-light)' },
              { icon: <Circle size={10} fill="var(--red)" stroke="none" />, label: t('kpi.overdue'),             val: String(overdueCount),  bg: 'var(--red-light)' },
            ].map((k, i) => (
              <div key={i} className="p-2.5 md:px-3.5 md:py-3 rounded-xl border border-[var(--border)] shadow-xs md:shadow-none" style={{ background: 'var(--surface)' }}>
                <div className="w-7 h-7 md:w-8 md:h-8" style={{ borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginBottom: 6 }}>{k.icon}</div>
                <div className="text-[15px] md:text-[18px] font-black" style={{ color: 'var(--text)' }}>{k.val}</div>
                <div className="text-[10.5px] md:text-[11.5px]" style={{ color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Filtres */}
          <div className="rounded-none md:rounded-xl border-0 md:border md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]" style={{ overflow: 'hidden' }}>
            <div className="flex-wrap p-0 mb-3 md:p-2.5 md:px-3.5 md:mb-0 md:border-b md:border-[var(--border)]" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={invStatus} onChange={e => setInvStatus(e.target.value)} className={filterStCls} style={filterSt}>
                <option value="">{t('filters.all_statuses')}</option>
                <option value="PENDING">{t('filters.pending')}</option>
                <option value="PAID">{t('filters.paid')}</option>
                <option value="OVERDUE">{t('filters.overdue')}</option>
                <option value="PARTIAL">{t('filters.partial')}</option>
                <option value="CANCELLED">{t('filters.cancelled')}</option>
              </select>
              <button className="text-xs md:text-xs px-3 py-1.5" style={{ ...btnPrim }} onClick={() => { setPage(1); fetchInvoices(1) }}>{t('actions.filter')}</button>
              <span className="sm:ml-auto text-[11.5px] md:text-xs" style={{ color: 'var(--text3)', fontWeight: 600 }}>
                {t('totals.factures').replace('{count}', String(pag.total))} · {t('totals.page_info').replace('{page}', String(pag.page)).replace('{pages}', String(pag.pages))}
              </span>
            </div>

            {invoices.length === 0 ? (
              <div className="text-xs md:text-sm px-4 py-8 md:px-5 md:py-10" style={{ textAlign: 'center', color: 'var(--text3)' }}>
                {invStatus ? t('empty_states.no_invoices_with_status').replace('{status}', getInvStatus(invStatus).label) : t('empty_states.no_invoices')}
              </div>
            ) : (
              <>
              {/* ── Cartes empilées — mobile ── */}
              <div className="md:hidden flex flex-col gap-2">
                {invoices.map((inv) => {
                  const st = getInvStatus(inv.status)
                  const paid = inv.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
                  return (
                    <div key={inv.id} className="rounded-xl shadow-xs" style={{ background: 'var(--surface)', padding: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{inv.student.firstName} {inv.student.lastName}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{inv.feePlan?.name ?? '—'}</div>
                        </div>
                        <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13, flexShrink: 0 }}>{fmtCFA(inv.amount)}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <span style={{ padding: '2px 7px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: paid > 0 ? 'var(--green)' : 'var(--text3)' }}>
                          {paid > 0 ? `${t('table_headers.paid')} : ${fmtCFA(paid)}` : '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {new Date(inv.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </span>
                        <button style={btnSecSm} onClick={() => onToast(`Facture ${inv.id.slice(0,8)} — ${inv.status}`, 'info')}>
                          {t('actions.view')}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* ── Tableau — desktop ── */}
              <div className="hidden md:block" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                  <thead>
                    <tr>{[t('table_headers.student'), t('table_headers.plan'), t('table_headers.amount'), t('table_headers.status'), t('table_headers.paid'), t('table_headers.date'), t('table_headers.actions')].map(h => (
                      <th key={h} style={thStyle}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv) => {
                      const st = getInvStatus(inv.status)
                      const paid = inv.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
                      return (
                        <tr key={inv.id}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                          <td style={tdStyle}>
                            <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 12.5 }}>
                              {inv.student.firstName} {inv.student.lastName}
                            </div>
                          </td>
                          <td style={{ ...tdStyle, fontSize: 12 }}>{inv.feePlan?.name ?? '—'}</td>
                          <td style={{ ...tdStyle, fontWeight: 700, color: 'var(--text)', fontSize: 12.5 }}>{fmtCFA(inv.amount)}</td>
                          <td style={tdStyle}>
                            <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>
                              {st.label}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: paid > 0 ? 'var(--green)' : 'var(--text3)' }}>
                              {paid > 0 ? fmtCFA(paid) : '—'}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, fontSize: 11.5 }}>
                            {new Date(inv.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                          </td>
                          <td style={tdStyle}>
                            <button style={btnSecSm} onClick={() => onToast(`Facture ${inv.id.slice(0,8)} — ${inv.status}`, 'info')}>
                              {t('actions.view')}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}

            {pag.pages > 1 && (
              <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'center', gap: 6 }}>
                <button style={btnSecSm} disabled={page <= 1}
                  onClick={() => { const p = page - 1; setPage(p); fetchInvoices(p) }}>{t('pagination.previous')}</button>
                <span style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>
                  {page} / {pag.pages}
                </span>
                <button style={btnSecSm} disabled={page >= pag.pages}
                  onClick={() => { const p = page + 1; setPage(p); fetchInvoices(p) }}>{t('pagination.next')}</button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Modal créer plan ── */}
      {createOpen && (
        <ModalOverlay onClose={() => { setCreateOpen(false); setPlanForm(EMPTY_PLAN) }}>
          <div className={sModalTitleCls} style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('modals.create_fee_plan.title')}</div>
          <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.name_label')}</div>
          <input className={sInCls} style={sIn} placeholder={t('modals.create_fee_plan.name_placeholder')} value={planForm.name} onChange={e => setPlanForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.amount_label')}</div>
              <input className={sInCls} style={sIn} type="number" min="0" placeholder={t('modals.create_fee_plan.amount_placeholder')} value={planForm.amount} onChange={e => setPlanForm(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.type_label')}</div>
              <select className={sInCls} style={sIn} value={planForm.feeType} onChange={e => setPlanForm(f => ({ ...f, feeType: e.target.value }))}>
                {FEE_TYPES.map(t => <option key={t} value={t}>{FEE_TYPE_LABEL[t] ?? t}</option>)}
              </select>
            </div>
          </div>
          <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.description_label')}</div>
          <input className={sInCls} style={sIn} placeholder={t('modals.create_fee_plan.description_placeholder')} value={planForm.description} onChange={e => setPlanForm(f => ({ ...f, description: e.target.value }))} />
          <div className={sLbCls} style={sLb}>{t('modals.create_fee_plan.due_date_label')}</div>
          <input className={sInCls} style={sIn} type="date" value={planForm.dueDate} onChange={e => setPlanForm(f => ({ ...f, dueDate: e.target.value }))} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <input type="checkbox" id="refund" checked={planForm.isRefundable} onChange={e => setPlanForm(f => ({ ...f, isRefundable: e.target.checked }))} />
            <label htmlFor="refund" style={{ fontSize: 12.5, color: 'var(--text2)', cursor: 'pointer' }}>{t('modals.create_fee_plan.refundable_label')}</label>
          </div>
          {planForm.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{planForm.error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => { setCreateOpen(false); setPlanForm(EMPTY_PLAN) }}>{t('actions.cancel')}</button>
            <button style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: planForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: planForm.loading ? 0.7 : 1 }} onClick={submitCreatePlan} disabled={planForm.loading}>
              {planForm.loading ? t('loading.creating') : t('actions.create_plan')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal modifier plan ── */}
      {modPlan.open && (
        <ModalOverlay onClose={() => setModPlan(EMPTY_MOD_PLAN)}>
          <div className={sModalTitleCls} style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('modals.edit_fee_plan.title')}</div>
          <div className={sLbCls} style={sLb}>{t('modals.edit_fee_plan.name_label')}</div>
          <input className={sInCls} style={sIn} value={modPlan.name} onChange={e => setModPlan(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div className={sLbCls} style={sLb}>{t('modals.edit_fee_plan.amount_label')}</div>
              <input className={sInCls} style={sIn} type="number" min="0" value={modPlan.amount} onChange={e => setModPlan(f => ({ ...f, amount: e.target.value }))} />
            </div>
            <div>
              <div className={sLbCls} style={sLb}>{t('modals.edit_fee_plan.type_label')}</div>
              <select className={sInCls} style={sIn} value={modPlan.feeType} onChange={e => setModPlan(f => ({ ...f, feeType: e.target.value }))}>
                {FEE_TYPES.map(t => <option key={t} value={t}>{FEE_TYPE_LABEL[t] ?? t}</option>)}
              </select>
            </div>
          </div>
          <div className={sLbCls} style={sLb}>{t('modals.edit_fee_plan.description_label')}</div>
          <input className={sInCls} style={sIn} value={modPlan.description} onChange={e => setModPlan(f => ({ ...f, description: e.target.value }))} />
          <div className={sLbCls} style={sLb}>{t('modals.edit_fee_plan.due_date_label')}</div>
          <input className={sInCls} style={sIn} type="date" value={modPlan.dueDate} onChange={e => setModPlan(f => ({ ...f, dueDate: e.target.value }))} />
          {modPlan.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{modPlan.error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setModPlan(EMPTY_MOD_PLAN)}>{t('actions.cancel')}</button>
            <button style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: modPlan.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: modPlan.loading ? 0.7 : 1 }} onClick={submitModPlan} disabled={modPlan.loading}>
              {modPlan.loading ? t('loading.saving') : t('actions.save')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal créer facture individuelle ── */}
      {invoiceOpen && (
        <ModalOverlay onClose={() => { setInvoiceOpen(false); setInvoiceForm(EMPTY_INVOICE) }}>
          <div className={sModalTitleCls} style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('modals.create_invoice.title')}</div>
          {invModalLoading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 30 }}>
              <div style={{ width: 26, height: 26, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
            </div>
          ) : (
            <>
              <div className={sLbCls} style={sLb}>{t('modals.create_invoice.student_label')}</div>
              <select className={sInCls} style={sIn} value={invoiceForm.studentId} onChange={e => setInvoiceForm(f => ({ ...f, studentId: e.target.value }))}>
                <option value="">{t('modals.create_invoice.student_placeholder')}</option>
                {invStudents.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.firstName} {s.lastName}{s.studentProfile?.class ? ` — ${s.studentProfile.class.name}` : ''}
                  </option>
                ))}
              </select>
              <div className={sLbCls} style={sLb}>{t('modals.create_invoice.plan_label')}</div>
              <select className={sInCls} style={sIn} value={invoiceForm.feePlanId} onChange={e => setInvoiceForm(f => ({ ...f, feePlanId: e.target.value }))}>
                <option value="">{t('modals.create_invoice.plan_placeholder')}</option>
                {invPlans.map(p => (
                  <option key={p.id} value={p.id}>{p.name} — {fmtCFA(p.amount)}</option>
                ))}
              </select>
              <div className={sLbCls} style={sLb}>{t('modals.create_invoice.description_label')}</div>
              <input className={sInCls} style={sIn} placeholder={t('modals.create_invoice.description_placeholder')} value={invoiceForm.description} onChange={e => setInvoiceForm(f => ({ ...f, description: e.target.value }))} />
            </>
          )}
          {invoiceForm.error && (
            <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '8px 12px', fontSize: 12, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
              {invoiceForm.error}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}
              onClick={() => { setInvoiceOpen(false); setInvoiceForm(EMPTY_INVOICE) }}>{t('actions.cancel')}</button>
            <button style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: invoiceForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: invoiceForm.loading ? 0.7 : 1 }}
              onClick={submitInvoice} disabled={invoiceForm.loading || invModalLoading}>
              {invoiceForm.loading ? t('loading.creating') : t('actions.create_invoice_action')}
            </button>
          </div>
        </ModalOverlay>
      )}

      {/* ── Modal générer factures ── */}
      {bulkForm.open && (
        <ModalOverlay onClose={() => setBulkForm(EMPTY_BULK)}>
          <div className={sModalTitleCls} style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('modals.bulk_generate.title')}</div>
          <div className="text-xs md:text-xs" style={{ color: 'var(--text3)', marginBottom: 14 }}>{bulkForm.planName}</div>
          <div className={sLbCls} style={sLb}>{t('modals.bulk_generate.year_label')}</div>
          <select className={sInCls} style={sIn} value={bulkForm.academicYearId} onChange={e => setBulkForm(f => ({ ...f, academicYearId: e.target.value }))}>
            <option value="">{t('modals.bulk_generate.year_placeholder')}</option>
            {bulkForm.years.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
          </select>
          <div style={{ background: 'var(--amber-light)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--amber)', fontWeight: 600, marginBottom: 12 }}>
            {t('modals.bulk_generate.warning')}
          </div>
          {bulkForm.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{bulkForm.error}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setBulkForm(EMPTY_BULK)}>{t('actions.cancel')}</button>
            <button style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: bulkForm.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: bulkForm.loading ? 0.7 : 1 }} onClick={submitBulk} disabled={bulkForm.loading}>
              {bulkForm.loading ? t('loading.generating') : t('actions.generate')}
            </button>
          </div>
        </ModalOverlay>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = { padding: '6px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '4px 9px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterStCls = 'rounded-lg px-2.5 py-1.5 text-xs font-semibold border md:border md:border-[var(--border2)] shadow-xs md:shadow-none'
const filterSt: React.CSSProperties = { background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
const thStyle: React.CSSProperties = { padding: '7px 11px', textAlign: 'left', fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '8px 11px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }

function ModalOverlay({ onClose, children }: { onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={e => e.stopPropagation()} className="px-4 py-4 md:px-6 md:py-5" style={{ background: 'var(--surface)', borderRadius: 14, width: 440, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
        {children}
      </div>
    </div>
  )
}

const sLbCls = 'text-[11px] md:text-[11.5px] mb-1'
const sLb: React.CSSProperties = { fontWeight: 700, color: 'var(--text3)' }
const sInCls = 'rounded-lg px-2.5 py-1.5 mb-2 text-xs md:text-[12.5px]'
const sIn: React.CSSProperties = { width: '100%', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none' }
const sModalTitleCls = 'text-[15px] md:text-[17px]'
