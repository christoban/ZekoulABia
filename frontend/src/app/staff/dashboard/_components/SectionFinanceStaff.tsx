'use client'
import { useState, useEffect, useCallback } from 'react'
import type { SessionUser } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Loader2, Smartphone } from 'lucide-react'
import SectionAPEEStaff from './SectionAPEEStaff'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  sessionUser?: SessionUser | null
  initialTab?: 'invoices' | 'apee'
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

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

const DEPENSE_CATEGORIES = ['catSupplies', 'catMaintenance', 'catUtilities', 'catFuel', 'catCommunication', 'catBankFees', 'catSalaries', 'catEvents', 'catOther']
const EMPTY_DEP = { label: '', amount: '', category: '', date: '' }

export default function SectionFinanceStaff({ onToast, sessionUser, initialTab = 'invoices' }: Props) {
  const t = useT('staff')
  const [tab, setTab]           = useState<'invoices' | 'apee'>(initialTab)
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

  useEffect(() => { setPage(1); fetchInvoices(1) }, [statusFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const initiateMobileMoney = async (invoice: InvoiceItem) => {
    const phone = prompt(t('finance.mobileMoneyPrompt', { firstName: invoice.student.firstName, lastName: invoice.student.lastName }))
    if (!phone?.trim()) return
    setPayingId(invoice.id)
    try {
      const res = await fetchApi('/api/v2/finance/payments/mobile', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          factureId: invoice.id,
          studentId: invoice.student.id,
          phoneNumber: phone.trim(),
          method: phone.startsWith('67') || phone.startsWith('68') ? 'ORANGE_MONEY' : 'MTN_MOMO',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('finance.paymentInitiated'), 'success')
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur Mobile Money', 'error')
    } finally {
      setPayingId(null)
    }
  }

  const sendReminder = async (invoice: InvoiceItem) => {
    setSendingId(invoice.id)
    try {
      await new Promise(r => setTimeout(r, 600))
      onToast(t('finance.smsSent', { firstName: invoice.student.firstName, lastName: invoice.student.lastName }), 'success')
    } finally {
      setSendingId(null)
    }
  }

  const totalPending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.amount, 0)
  const totalPartial = invoices.filter(i => i.status === 'PARTIAL').reduce((s, i) => s + i.amount, 0)
  const canSeeAPEE = sessionUser?.permissions?.some(p => p === 'VIEW_APEE' || p === 'MANAGE_APEE') ?? true

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Onglets Finance & APEE */}
      {canSeeAPEE && (
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, borderBottom: '1px solid var(--border)', paddingBottom: 8 }}>
          <button
            onClick={() => setTab('invoices')}
            style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: tab === 'invoices' ? 'var(--blue-light)' : 'transparent',
              color: tab === 'invoices' ? 'var(--blue)' : 'var(--text2)',
              border: tab === 'invoices' ? '1px solid rgba(29,78,216,0.3)' : '1px solid transparent',
              cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            Factures & Paiements
          </button>
          <button
            onClick={() => setTab('apee')}
            style={{
              padding: '5px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
              background: tab === 'apee' ? 'var(--blue-light)' : 'transparent',
              color: tab === 'apee' ? 'var(--blue)' : 'var(--text2)',
              border: tab === 'apee' ? '1px solid rgba(29,78,216,0.3)' : '1px solid transparent',
              cursor: 'pointer', fontFamily: 'inherit'
            }}
          >
            Transparence APEE
          </button>
        </div>
      )}

      {tab === 'apee' ? (
        <SectionAPEEStaff onToast={onToast} />
      ) : (
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
              <div style={{ fontSize: 16, fontWeight: 900, color: k.color }}>{k.val}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={filterSt}>
            <option value="">{t('finance.filterAllStatuses')}</option>
            <option value="PENDING">{t('finance.filterUnpaid')}</option>
            <option value="PARTIAL">{t('finance.filterPartial')}</option>
            <option value="PAID">{t('finance.filterPaid')}</option>
            <option value="OVERDUE">{t('finance.filterOverdue')}</option>
          </select>
          <button style={btnPrim} onClick={() => { setPage(1); fetchInvoices(1) }}>{t('finance.filter')}</button>
          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--text3)', fontWeight: 600 }}>
            {t('finance.pageInfo', { page: pag.page, pages: pag.pages, total: pag.total })}
          </span>
        </div>

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 50 }}>
            <div style={{ width: 32, height: 32, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        )}

        {!loading && error && <div style={{ padding: '16px 20px', color: 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={16} strokeWidth={2} /> {error}</div>}

        {!loading && !error && invoices.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
            {t('finance.noInvoices')}
          </div>
        )}

        {!loading && !error && invoices.length > 0 && (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
                <thead>
                  <tr>{[
                    t('finance.tableHeaderStudent'),
                    t('finance.tableHeaderPlan'),
                    t('finance.tableHeaderAmount'),
                    t('finance.tableHeaderPaid'),
                    t('finance.tableHeaderStatus'),
                    t('finance.tableHeaderActions'),
                  ].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const st = INV_STATUS[inv.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                    const invStatusKey = inv.status === 'PENDING' ? 'statusUnpaid' : inv.status === 'PARTIAL' ? 'statusPartial' : inv.status === 'PAID' ? 'statusPaid' : inv.status === 'OVERDUE' ? 'statusOverdue' : 'statusCancelled'
                    const paid = inv.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
                    return (
                      <tr key={inv.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                          {inv.student.firstName} {inv.student.lastName}
                        </td>
                        <td style={{ ...tdSt, fontSize: 12 }}>{inv.feePlan?.name ?? '—'}</td>
                        <td style={{ ...tdSt, fontWeight: 700 }}>{fmtCFA(inv.amount)}</td>
                        <td style={tdSt}>
                          <span style={{ fontWeight: 700, color: paid > 0 ? 'var(--green)' : 'var(--text3)' }}>
                            {paid > 0 ? fmtCFA(paid) : '—'}
                          </span>
                        </td>
                        <td style={tdSt}>
                          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>
                            {t(`finance.${invStatusKey}`)}
                          </span>
                        </td>
                        <td style={tdSt}>
                          {(inv.status === 'PENDING' || inv.status === 'PARTIAL') && (
                            <div style={{ display: 'flex', gap: 5 }}>
                              <button
                                style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, background: 'var(--blue-light)', color: 'var(--blue)', border: '1px solid rgba(29,78,216,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                                onClick={() => initiateMobileMoney(inv)}
                                disabled={payingId === inv.id}>
                                {payingId === inv.id ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : <Smartphone size={12} strokeWidth={2} />}
                              </button>
                              <button
                                style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700, background: 'var(--bg2)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                                onClick={() => sendReminder(inv)}
                                disabled={sendingId === inv.id}>
                                {sendingId === inv.id ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : <><Smartphone size={12} strokeWidth={2} /> SMS</>}
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
              {/* Libellé */}
              <div>
                <label style={fLb}>{t('finance.depenseLabelLabel')} <span style={{ color: 'var(--red)' }}>*</span></label>
                <input
                  type="text"
                  value={depenseForm.label}
                  onChange={e => setDepenseForm(f => ({ ...f, label: e.target.value }))}
                  placeholder={t('finance.depenseLabelPlaceholder')}
                  style={fIn}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--green)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg2)' }}
                />
              </div>

              {/* Montant */}
              <div>
                <label style={fLb}>{t('finance.depenseAmountLabel')} <span style={{ color: 'var(--red)' }}>*</span></label>
                <input
                  type="number"
                  min="1"
                  value={depenseForm.amount}
                  onChange={e => setDepenseForm(f => ({ ...f, amount: e.target.value }))}
                  placeholder={t('finance.depenseAmountPlaceholder')}
                  style={fIn}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--green)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg2)' }}
                />
              </div>

              {/* Catégorie */}
              <div>
                <label style={fLb}>{t('finance.depenseCategoryLabel')} <span style={{ color: 'var(--text3)', fontWeight: 600, fontSize: 11 }}>({t('finance.depenseCategoryOptional')})</span></label>
                <select
                  value={depenseForm.category}
                  onChange={e => setDepenseForm(f => ({ ...f, category: e.target.value }))}
                  style={{ ...fIn, cursor: 'pointer' }}>
                  <option value="">{t('finance.depenseCategoryPlaceholder')}</option>
                  {DEPENSE_CATEGORIES.map(c => <option key={c} value={c}>{t(`finance.${c}`)}</option>)}
                </select>
              </div>

              {/* Date */}
              <div>
                <label style={fLb}>{t('finance.depenseDateLabel')} <span style={{ color: 'var(--text3)', fontWeight: 600, fontSize: 11 }}>({t('finance.depenseDateOptional')})</span></label>
                <input
                  type="date"
                  value={depenseForm.date}
                  onChange={e => setDepenseForm(f => ({ ...f, date: e.target.value }))}
                  style={fIn}
                  onFocus={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--green)'; (e.currentTarget as HTMLElement).style.background = 'var(--surface)' }}
                  onBlur={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border2)'; (e.currentTarget as HTMLElement).style.background = 'var(--bg2)' }}
                />
              </div>

              {/* Erreur dans la modale */}
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
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const btnPrim: React.CSSProperties = { padding: '6px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--green),var(--green2))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
const btnSec: React.CSSProperties = { padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, padding: '5px 9px', fontSize: 12, fontWeight: 600, color: 'var(--text2)', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '7px 11px', textAlign: 'left', fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '8px 11px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
const fLb: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: 'var(--text2)', marginBottom: 3, display: 'block', letterSpacing: '0.4px', textTransform: 'uppercase' }
const fIn: React.CSSProperties = { width: '100%', padding: '7px 10px', background: 'var(--bg2)', border: '1.5px solid var(--border2)', borderRadius: 8, color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit', fontWeight: 600, outline: 'none', transition: 'all 0.15s', boxSizing: 'border-box' }
