'use client'
import { useState, useEffect, useCallback } from 'react'
import type { SessionUser } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Loader2, Smartphone, Wallet, Pencil } from 'lucide-react'
import SectionAPEEStaff from './SectionAPEEStaff'
import SectionPlansStaff from './SectionPlansStaff'
import { fmtCFA } from '@/components/finance/ModalOverlay'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  sessionUser?: SessionUser | null
  initialTab?: 'invoices' | 'apee' | 'plans'
}

interface Payment { id: string; amount: number; status: string; paidAt: string | null; method: string }
interface InvoiceItem {
  id: string; amount: number; currency: string; status: string; dueDate: string | null; createdAt: string
  student: { id: string; firstName: string; lastName: string }
  feePlan: { id: string; name: string; feeType: string; amount: number } | null
  payments: Payment[]
}
interface Pagination { total: number; page: number; pages: number }

const INV_STATUS: Record<string, { bg: string; color: string }> = {
  PENDING:    { bg: 'var(--red-light)', color: 'var(--red)' },
  PARTIAL:    { bg: 'var(--amber-light)', color: 'var(--amber)' },
  PAID:       { bg: 'var(--green-light)', color: 'var(--green)' },
  OVERDUE:    { bg: 'var(--red-light)', color: 'var(--red)' },
  CANCELLED:  { bg: 'var(--bg2)', color: 'var(--text2)' },
}

const DEPENSE_CATEGORIES = ['catSupplies', 'catMaintenance', 'catUtilities', 'catFuel', 'catCommunication', 'catBankFees', 'catSalaries', 'catEvents', 'catOther']
const EMPTY_DEP = { label: '', amount: '', category: '', date: '' }

export default function SectionFinanceStaff({ onToast, sessionUser, initialTab = 'invoices' }: Props) {
  const t = useT('staff')
  const [tab, setTab]           = useState<'invoices' | 'apee' | 'plans'>(initialTab)
  const [invoices, setInvoices] = useState<InvoiceItem[]>([])
  const [pag, setPag]           = useState<Pagination>({ total: 0, page: 1, pages: 1 })
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [page, setPage]         = useState(1)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [payingId, setPayingId]   = useState<string | null>(null)

  const [depenseOpen, setDepenseOpen]       = useState(false)
  const [depenseForm, setDepenseForm]       = useState(EMPTY_DEP)
  const [depenseSending, setDepenseSending] = useState(false)
  const [depenseError, setDepenseError]     = useState<string | null>(null)

  const hasMF = sessionUser?.permissions?.includes('MANAGE_FINANCE') ?? false

  const submitDepense = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!depenseForm.label.trim()) { setDepenseError(t('finance.depenseLabelRequired')); return }
    const amt = parseFloat(depenseForm.amount)
    if (!depenseForm.amount || isNaN(amt) || amt <= 0) { setDepenseError(t('finance.depenseAmountInvalid')); return }
    setDepenseSending(true); setDepenseError(null)
    try {
      const body: Record<string, unknown> = { label: depenseForm.label.trim(), amount: amt }
      if (depenseForm.category.trim()) body.category = depenseForm.category.trim()
      if (depenseForm.date) body.date = depenseForm.date
      const res = await fetchApi('/api/v2/finance/expenses', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      onToast(t('finance.depenseSuccess'), 'success')
      setDepenseOpen(false)
      setDepenseForm(EMPTY_DEP)
    } catch (err) {
      setDepenseError(err instanceof Error ? err.message : 'Erreur serveur')
    } finally {
      setDepenseSending(false)
    }
  }

  const fetchInvoices = useCallback(async (pg = 1) => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: '20', page: String(pg) })
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetchApi(`/api/v2/finance/invoices?${params}`, { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setInvoices(data.data || [])
      setPag(data.pagination ?? { total: 0, page: pg, pages: 1 })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    if (tab === 'invoices') { setPage(1); fetchInvoices(1) }
  }, [tab, fetchInvoices])

  useEffect(() => { setPage(1); fetchInvoices(1) }, [statusFilter, fetchInvoices])

  const initiateMobileMoney = async (invoice: InvoiceItem) => {
    const phone = prompt(t('finance.mobileMoneyPrompt', { firstName: invoice.student.firstName, lastName: invoice.student.lastName }))
    if (!phone?.trim()) return
    setPayingId(invoice.id)
    try {
      const res = await fetchApi('/api/v2/finance/payments/mobile', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: invoice.id,
          phone: phone.trim(),
          amount: invoice.amount,
          operator: phone.startsWith('67') || phone.startsWith('650') || phone.startsWith('651') || phone.startsWith('652') || phone.startsWith('653') || phone.startsWith('654') ? 'MTN' : 'ORANGE',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      onToast(t('finance.paymentInitiated'), 'info')
      fetchInvoices(page)
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur Mobile Money', 'error')
    } finally {
      setPayingId(null)
    }
  }

  const sendSmsReminder = async (invoice: InvoiceItem) => {
    setSendingId(invoice.id)
    try {
      const res = await fetchApi(`/api/v2/finance/invoices/${invoice.id}/remind-sms`, {
        method: 'POST', credentials: 'include',
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      onToast(t('finance.smsSent', { firstName: invoice.student.firstName, lastName: invoice.student.lastName }), 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur envoi SMS', 'error')
    } finally {
      setSendingId(null)
    }
  }

  const totalPending = invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE').reduce((s, i) => s + i.amount, 0)
  const totalPartial = invoices.filter(i => i.status === 'PARTIAL').reduce((s, i) => s + i.amount, 0)

  return (
    <div>
      {/* ── Onglets ── */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
        <button
          style={{
            ...btnSec,
            background: tab === 'invoices' ? 'var(--green-light)' : 'var(--surface)',
            color: tab === 'invoices' ? 'var(--green)' : 'var(--text2)',
            borderColor: tab === 'invoices' ? 'var(--green)' : 'var(--border2)',
          }}
          onClick={() => setTab('invoices')}
        >
          {t('finance.tabInvoices') || 'Factures & Paiements'}
        </button>

        {hasMF && (
          <button
            style={{
              ...btnSec,
              background: tab === 'plans' ? 'var(--green-light)' : 'var(--surface)',
              color: tab === 'plans' ? 'var(--green)' : 'var(--text2)',
              borderColor: tab === 'plans' ? 'var(--green)' : 'var(--border2)',
            }}
            onClick={() => setTab('plans')}
          >
            {t('finance.tabPlans') || 'Plans de frais'}
          </button>
        )}

        {hasMF && (
          <button
            style={{
              ...btnSec,
              background: tab === 'apee' ? 'var(--green-light)' : 'var(--surface)',
              color: tab === 'apee' ? 'var(--green)' : 'var(--text2)',
              borderColor: tab === 'apee' ? 'var(--green)' : 'var(--border2)',
            }}
            onClick={() => setTab('apee')}
          >
            {t('finance.tabAPEE') || 'Transparence APEE'}
          </button>
        )}
      </div>

      {/* ── Onglet APEE ── */}
      {tab === 'apee' ? (
        <SectionAPEEStaff onToast={onToast} />

      /* ── Onglet Plans de frais (MANAGE_FINANCE) ── */
      ) : tab === 'plans' && hasMF ? (
        <SectionPlansStaff
          onToast={onToast}
          onInvoiceCreated={() => {
            setTab('invoices')
            fetchInvoices(1)
          }}
        />

      /* ── Onglet Factures & Paiements ── */
      ) : tab === 'invoices' ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <div style={sTitle}>{t('finance.title')}</div>
              <div style={sSub}>{t('finance.subtitle')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {hasMF && (
                <button style={btnPrim} onClick={() => { setDepenseOpen(true); setDepenseError(null); setDepenseForm(EMPTY_DEP) }}>
                  {t('finance.recordExpense')}
                </button>
              )}
              <button style={btnSec} onClick={() => fetchInvoices(page)}>{t('finance.refresh')}</button>
            </div>
          </div>

      {/* KPIs */}
      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
          {[
            { label: t('finance.kpiTotalUnpaid'),  val: fmtCFA(totalPending), bg: 'var(--red-light)', color: 'var(--red)' },
            { label: t('finance.kpiPartialPayments'),   val: fmtCFA(totalPartial), bg: 'var(--amber-light)', color: 'var(--amber)' },
            { label: '', val: t('finance.kpiResults', { count: pag.total }), bg: 'var(--bg2)', color: 'var(--text2)' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '10px 14px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>{k.label}</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: k.color || 'var(--text)' }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'center' }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={filterSt}>
          <option value="">{t('finance.filterAllStatuses')}</option>
          <option value="PENDING">{t('finance.filterUnpaid')}</option>
          <option value="PARTIAL">{t('finance.filterPartial')}</option>
          <option value="PAID">{t('finance.filterPaid')}</option>
          <option value="OVERDUE">{t('finance.filterOverdue')}</option>
        </select>
        <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 'auto' }}>
          {t('finance.pageInfo', { page: pag.page, pages: pag.pages, total: pag.total })}
        </span>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px', margin: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertTriangle size={15} strokeWidth={2} />
            <span style={{ fontWeight: 700, color: 'var(--red)', flex: 1, fontSize: 13 }}>{error}</span>
            <button onClick={() => fetchInvoices(page)} style={{ padding: '5px 12px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1.5px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }}>
              {t('finance.refresh')}
            </button>
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text3)', fontSize: 13 }}>
            {t('finance.noInvoices')}
          </div>
        ) : (
          <>
            <div style={{ overflowX: 'auto' }}>
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
                    const totalPaid = inv.payments.filter(p => p.status === 'COMPLETED').reduce((s, p) => s + p.amount, 0)
                    const stCfg = INV_STATUS[inv.status] || { bg: 'var(--bg2)', color: 'var(--text2)' }
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
                            {t(`finance.status${inv.status === 'PENDING' ? 'Unpaid' : inv.status === 'PARTIAL' ? 'Partial' : inv.status === 'PAID' ? 'Paid' : inv.status === 'OVERDUE' ? 'Overdue' : 'Cancelled'}`)}
                          </span>
                        </td>
                        <td style={tdSt}>
                          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                            {inv.status !== 'PAID' && (
                              <button
                                style={{ ...btnSecSm, display: 'flex', alignItems: 'center', gap: 4 }}
                                disabled={payingId === inv.id}
                                onClick={() => initiateMobileMoney(inv)}
                              >
                                {payingId === inv.id ? <Loader2 size={11} className="animate-spin" /> : <Smartphone size={11} />}
                                Mobile Money
                              </button>
                            )}
                            {inv.status !== 'PAID' && (
                              <button
                                style={btnSecSm}
                                disabled={sendingId === inv.id}
                                onClick={() => sendSmsReminder(inv)}
                              >
                                {sendingId === inv.id ? <Loader2 size={11} className="animate-spin" /> : 'SMS'}
                              </button>
                            )}
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
                <button style={btnSec} disabled={page <= 1}
                  onClick={() => { const p = page - 1; setPage(p); fetchInvoices(p) }}>{t('finance.previous')}</button>
                <span style={{ padding: '4px 10px', fontSize: 12, fontWeight: 700, color: 'var(--text2)' }}>{page}/{pag.pages}</span>
                <button style={btnSec} disabled={page >= pag.pages}
                  onClick={() => { const p = page + 1; setPage(p); fetchInvoices(p) }}>{t('finance.next')}</button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modale : Enregistrer une dépense ── */}
      {depenseOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget && !depenseSending) { setDepenseOpen(false) } }}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, border: '1px solid var(--border)', width: '100%', maxWidth: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>
            <div className="px-4 py-3 md:px-5 md:py-3.5" style={{ borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{t('finance.depenseModalTitle')}</div>
              <button onClick={() => !depenseSending && setDepenseOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: 18, color: 'var(--text3)', cursor: 'pointer', lineHeight: 1, padding: 2 }}>×</button>
            </div>

            <form onSubmit={submitDepense} className="px-4 py-3 md:px-5 md:py-4" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={fLb}>{t('finance.depenseLabelLabel')} <span style={{ color: 'var(--red)' }}>*</span></label>
                <input type="text" value={depenseForm.label} onChange={e => setDepenseForm(f => ({ ...f, label: e.target.value }))} placeholder={t('finance.depenseLabelPlaceholder')} style={fIn}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--green)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg2)' }} />
              </div>
              <div>
                <label style={fLb}>{t('finance.depenseAmountLabel')} <span style={{ color: 'var(--red)' }}>*</span></label>
                <input type="number" min="1" value={depenseForm.amount} onChange={e => setDepenseForm(f => ({ ...f, amount: e.target.value }))} placeholder={t('finance.depenseAmountPlaceholder')} style={fIn}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--green)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg2)' }} />
              </div>
              <div>
                <label style={fLb}>{t('finance.depenseCategoryLabel')} <span style={{ color: 'var(--text3)', fontWeight: 600, fontSize: 11 }}>({t('finance.depenseCategoryOptional')})</span></label>
                <select value={depenseForm.category} onChange={e => setDepenseForm(f => ({ ...f, category: e.target.value }))} style={{ ...fIn, cursor: 'pointer' }}>
                  <option value="">{t('finance.depenseCategoryPlaceholder')}</option>
                  {DEPENSE_CATEGORIES.map(c => <option key={c} value={c}>{t(`finance.${c}`)}</option>)}
                </select>
              </div>
              <div>
                <label style={fLb}>{t('finance.depenseDateLabel')} <span style={{ color: 'var(--text3)', fontWeight: 600, fontSize: 11 }}>({t('finance.depenseDateOptional')})</span></label>
                <input type="date" value={depenseForm.date} onChange={e => setDepenseForm(f => ({ ...f, date: e.target.value }))} style={fIn}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--green)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg2)' }} />
              </div>
              {depenseError && (
                <div style={{ background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '8px 12px', color: 'var(--red)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={13} strokeWidth={2} /> {depenseError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 }}>
                <button type="button" onClick={() => setDepenseOpen(false)} disabled={depenseSending} style={btnSec}>
                  {t('finance.cancel')}
                </button>
                <button type="submit" disabled={depenseSending}
                  style={{ ...btnPrim, opacity: depenseSending ? 0.7 : 1, cursor: depenseSending ? 'wait' : 'pointer' }}>
                  {depenseSending ? t('finance.saving') : t('finance.save')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
        </>
      ) : null}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = { padding: '6px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const btnSecSm: React.CSSProperties = { padding: '4px 9px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '5px 9px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '7px 11px', textAlign: 'left', fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '8px 11px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
const fLb: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 3, display: 'block', letterSpacing: '0.4px', textTransform: 'uppercase' }
const fIn: React.CSSProperties = { width: '100%', padding: '7px 10px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box' }
