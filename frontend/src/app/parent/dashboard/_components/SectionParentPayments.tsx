'use client'
import { useState, useEffect, useCallback } from 'react'
import { Book, AlertTriangle, Smartphone, Check, Circle, CreditCard, Search } from 'lucide-react'
import type { Toast } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: Toast['type']) => void
}

interface Child { studentId: string; prenom: string; nom: string }

interface Payment { id: string; amount: number; status: string; paidAt: string | null; method: string }
interface Invoice {
  id: string; amount: number; currency: string; status: string
  dueDate: string | null; createdAt: string; description: string | null
  student: { id: string; firstName: string; lastName: string }
  feePlan: { id: string; name: string; feeType: string; amount: number } | null
  payments: Payment[]
}

function invStatus(tf: (k: string) => string): Record<string, { bg: string; color: string; label: string }> {
  return {
    PENDING:   { bg: 'var(--amber-light)', color: 'var(--amber)', label: tf('invoice_status.PENDING')  },
    PAID:      { bg: 'var(--green-light)', color: 'var(--green)', label: tf('invoice_status.PAID')     },
    OVERDUE:   { bg: 'var(--red-light)', color: 'var(--red)', label: tf('invoice_status.OVERDUE')   },
    CANCELLED: { bg: 'var(--bg2)', color: 'var(--text2)', label: tf('invoice_status.CANCELLED') },
    PARTIAL:   { bg: 'var(--blue-light)', color: 'var(--blue)', label: tf('invoice_status.PARTIAL')   },
  }
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

export default function SectionParentPayments({ onToast }: Props) {
  const t = useT('parent')
  const tf = useT('finance')
  const tc = useT('common')
  const isOnline = useOnlineStatus()

  const [children, setChildren]     = useState<Child[]>([])
  const [invoices, setInvoices]     = useState<Invoice[]>([])
  const [childFilter, setChildFilter] = useState('')
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [minesecConcerned, setMinesecConcerned] = useState(false)
  const [guideOpen, setGuideOpen]   = useState(false)

  // ── Modal paiement ──────────────────────────────────────────────────────────
  const [modal, setModal] = useState<{
    open: boolean; invoiceId: string; amount: number; label: string
    method: 'MTN_MOMO' | 'ORANGE_MONEY'; phone: string; loading: boolean; error: string
  }>({ open: false, invoiceId: '', amount: 0, label: '', method: 'MTN_MOMO', phone: '', loading: false, error: '' })

  const fetchChildren = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' })
      const d = await res.json()
      if (d.success) setChildren(d.data || [])
    } catch { /* silencieux */ }
  }, [t, tf, tc])

  const fetchInvoices = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const params = new URLSearchParams({ limit: '50' })
      if (childFilter) params.set('studentId', childFilter)
      const res = await fetchApi(`/api/v2/parent/invoices?${params}`, { credentials: 'include' })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || tf('errors.server_error'))
      setInvoices(d.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorLoad'))
    } finally { setLoading(false) }
  }, [childFilter])

  useEffect(() => { fetchChildren() }, [fetchChildren])
  useEffect(() => { fetchInvoices() }, [fetchInvoices])

  // Rafraîchissement temps réel quand l'assistant IA initie un paiement.
  useEffect(() => {
    const onChanged = (e: Event) => {
      if ((e as CustomEvent<{ entity?: string }>).detail?.entity === 'payment') fetchInvoices()
    }
    window.addEventListener('zekoulabia:data-changed', onChanged)
    return () => window.removeEventListener('zekoulabia:data-changed', onChanged)
  }, [fetchInvoices])
  useEffect(() => {
    (async () => {
      try {
        const res = await fetchApi('/api/v2/school/me', { credentials: 'include' })
        const d = await res.json()
        setMinesecConcerned(Boolean(d?.data?.minesecSchoolCode))
      } catch { /* silencieux */ }
    })()
  }, [])

  const openModal = (inv: Invoice) => {
    const paidAmt = inv.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
    const remaining = Math.max(0, inv.amount - paidAmt)
    setModal({
      open: true, invoiceId: inv.id, amount: remaining,
      label: inv.feePlan?.name ?? inv.description ?? 'Facture',
      method: 'MTN_MOMO', phone: '', loading: false, error: '',
    })
  }

  const submitPayment = async () => {
    if (!modal.phone.trim()) { setModal(m => ({ ...m, error: t('payments.phoneRequired') })); return }
    setModal(m => ({ ...m, loading: true, error: '' }))
    try {
      const res = await fetchApi('/api/v2/parent/pay', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: modal.invoiceId, method: modal.method, phoneNumber: modal.phone }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.message || tf('errors.generic_error'))
      onToast(t('payments.paymentInitiated'), 'success')
      setModal(m => ({ ...m, open: false }))
      fetchInvoices()
    } catch (err) {
      setModal(m => ({ ...m, error: err instanceof Error ? err.message : tf('errors.generic_error'), loading: false }))
    }
  }

  if (!isOnline) return <OfflineEmptyState message={t('payments.offlineMessage')} />

  const unpaid = invoices.filter(i => i.status === 'PENDING' || i.status === 'OVERDUE' || i.status === 'PARTIAL')
  const totalDu = unpaid.reduce((s, i) => {
    const paid = i.payments.filter(p => p.status === 'PAID').reduce((ss, p) => ss + p.amount, 0)
    return s + Math.max(0, i.amount - paid)
  }, 0)

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 sm:gap-4 mb-2 sm:mb-4">
        <div>
          <div style={sTitle}>{t('payments.title')}</div>
          <div style={sSub}>{t('payments.subtitle')}</div>
        </div>
        {children.length > 0 && (
          <select
            value={childFilter}
            onChange={e => setChildFilter(e.target.value)}
            className="w-full sm:w-auto h-10 sm:h-9"
            style={sSelect}
          >
            <option value="">{t('payments.allChildren')}</option>
            {children.map(c => <option key={c.studentId} value={c.studentId}>{c.prenom} {c.nom}</option>)}
          </select>
        )}
      </div>

      {/* Guide MINESEC — uniquement si l'école utilise le système national cartescolaire.cm */}
      {minesecConcerned && (
        <div style={{ background: 'var(--blue-light)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: 'var(--blue)', display: 'flex', alignItems: 'center' }}><Book size={18} strokeWidth={2} /></span>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--blue)' }}>{t('minesecGuide.title')}</div>
                <div style={{ fontSize: 12, color: 'var(--blue)', marginTop: 1 }}>{t('minesecGuide.intro')}</div>
              </div>
            </div>
            <button onClick={() => setGuideOpen(o => !o)}
              className="h-8 px-3"
              style={{ borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--blue)', border: '1px solid var(--blue)', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
              {guideOpen ? t('minesecGuide.hide') : t('minesecGuide.show')}
            </button>
          </div>

          {guideOpen && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(37,99,235,0.2)' }}>
              <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--text2)', fontSize: 12, lineHeight: 1.6 }}>
                <li>{t('minesecGuide.step1')}</li>
                <li>{t('minesecGuide.step2')}</li>
                <li>{t('minesecGuide.step3')}</li>
                <li>{t('minesecGuide.step4')}</li>
              </ol>

              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginTop: 10, marginBottom: 4 }}>{t('minesecGuide.operatorsTitle')}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{t('minesecGuide.operatorsList')}</div>

              <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, fontStyle: 'italic' }}>{t('minesecGuide.receiptNote')}</div>

              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>{t('minesecGuide.examNote')}</div>

              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                <a href="https://cartescolaire.cm/pay-fees" target="_blank" rel="noopener noreferrer"
                  className="h-8 px-3 inline-flex items-center gap-1.5"
                  style={{ borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'var(--blue)', color: 'white', textDecoration: 'none' }}>
                  <CreditCard size={12} strokeWidth={2} /> {t('minesecGuide.payLink')}
                </a>
                <a href="https://cartescolaire.cm/verify-payment" target="_blank" rel="noopener noreferrer"
                  className="h-8 px-3 inline-flex items-center gap-1.5"
                  style={{ borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--blue)', border: '1px solid var(--blue)', textDecoration: 'none' }}>
                  <Search size={12} strokeWidth={2} /> {t('minesecGuide.verifyLink')}
                </a>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Alerte si factures impayées */}
      {unpaid.length > 0 && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid rgba(217,119,6,0.2)', borderRadius: 10, padding: '10px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ color: 'var(--amber)', display: 'flex', alignItems: 'center' }}><AlertTriangle size={18} strokeWidth={2} /></span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--amber)' }}>
              {t('payments.pendingPayment').replace('{count}', String(unpaid.length))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 2 }}>
              {t('payments.remainingDue').replace('{amount}', fmtCFA(totalDu))}
            </div>
          </div>
        </div>
      )}

      {/* Liste des factures */}
      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{tc('status.loading')}</div>
        ) : error ? (
          <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--red)', fontWeight: 700, fontSize: 12.5 }}>{error}</div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}><Smartphone size={44} strokeWidth={2} /></div>
            <div style={{ fontSize: 17 }}>{t('payments.noInvoices')}</div>
          </div>
        ) : (
          <>
            {/* Vue mobile: Cartes tactiles compactes */}
            <div className="md:hidden divide-y divide-[var(--border)]">
              {invoices.map(inv => {
                const INV_STATUS = invStatus(tf)
                const st = INV_STATUS[inv.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: inv.status }
                const paid = inv.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
                const remaining = Math.max(0, inv.amount - paid)
                const canPay = (inv.status === 'PENDING' || inv.status === 'OVERDUE' || inv.status === 'PARTIAL') && remaining > 0

                return (
                  <div key={inv.id} className="p-3.5 space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-[13px] font-bold text-[var(--text)]">
                          {inv.student.firstName} {inv.student.lastName}
                        </div>
                        <div className="text-[11.5px] text-[var(--text2)] mt-0.5">
                          {inv.feePlan?.name ?? inv.description ?? 'Facture'}
                        </div>
                      </div>
                      <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 10.5, fontWeight: 700, background: st.bg, color: st.color, whiteSpace: 'nowrap' }}>
                        {st.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-2.5 rounded-lg bg-[var(--bg)] border border-[var(--border)] text-center">
                      <div>
                        <div className="text-[10px] uppercase font-bold text-[var(--text3)]">{tf('table_headers.amount')}</div>
                        <div className="text-[11.5px] font-bold text-[var(--text)] mt-0.5">{fmtCFA(inv.amount)}</div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-[var(--text3)]">{tf('table_headers.paid')}</div>
                        <div className="text-[11.5px] font-bold mt-0.5" style={{ color: paid > 0 ? 'var(--green)' : 'var(--text3)' }}>
                          {paid > 0 ? fmtCFA(paid) : '—'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] uppercase font-bold text-[var(--text3)]">{t('payments.remaining')}</div>
                        <div className="text-[11.5px] font-bold mt-0.5" style={{ color: remaining > 0 ? 'var(--red)' : 'var(--green)' }}>
                          {remaining > 0 ? fmtCFA(remaining) : 'Soldé'}
                        </div>
                      </div>
                    </div>

                    {canPay && (
                      <button
                        onClick={() => openModal(inv)}
                        className="w-full h-10 rounded-lg text-xs font-bold text-white flex items-center justify-center gap-2"
                        style={{ background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))' }}
                      >
                        <Smartphone size={14} strokeWidth={2} />
                        {t('payments.payButton')} ({fmtCFA(remaining)})
                      </button>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Vue desktop: Tableau complet */}
            <div className="hidden md:block" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
                <thead>
                  <tr>{[tf('table_headers.student'), t('payments.libelle'), tf('table_headers.amount'), tf('table_headers.paid'), t('payments.remaining'), tf('table_headers.status'), tf('table_headers.actions')].map(h => (
                    <th key={h} style={thSt}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {invoices.map(inv => {
                    const INV_STATUS = invStatus(tf)
                    const st = INV_STATUS[inv.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)', label: inv.status }
                    const paid = inv.payments.filter(p => p.status === 'PAID').reduce((s, p) => s + p.amount, 0)
                    const remaining = Math.max(0, inv.amount - paid)
                    const canPay = (inv.status === 'PENDING' || inv.status === 'OVERDUE' || inv.status === 'PARTIAL') && remaining > 0
                    return (
                      <tr key={inv.id}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                        <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                          {inv.student.firstName} {inv.student.lastName}
                        </td>
                        <td style={{ ...tdSt, fontSize: 12 }}>{inv.feePlan?.name ?? inv.description ?? '—'}</td>
                        <td style={{ ...tdSt, fontWeight: 700 }}>{fmtCFA(inv.amount)}</td>
                        <td style={tdSt}>
                          <span style={{ fontWeight: 700, color: paid > 0 ? 'var(--green)' : 'var(--text3)' }}>
                            {paid > 0 ? fmtCFA(paid) : '—'}
                          </span>
                        </td>
                        <td style={tdSt}>
                          <span style={{ fontWeight: 700, color: remaining > 0 ? 'var(--red)' : 'var(--green)' }}>
                            {remaining > 0 ? fmtCFA(remaining) : <Check size={14} strokeWidth={2.5} />}
                          </span>
                        </td>
                        <td style={tdSt}>
                          <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: st.bg, color: st.color }}>{st.label}</span>
                        </td>
                        <td style={tdSt}>
                          {canPay && (
                            <button style={{ ...btnPay, display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => openModal(inv)}><Smartphone size={12} strokeWidth={2} /> {t('payments.payButton')}</button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Modal paiement */}
      {modal.open && (
        <div onClick={() => !modal.loading && setModal(m => ({ ...m, open: false }))}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="px-4 py-4 md:px-6 md:py-5"
            style={{ background: 'var(--surface)', borderRadius: 14, width: 420, maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              {t('payments.modalTitle')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>{modal.label}</div>

            <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text2)' }}>{t('payments.amountToPay')}</span>
              <span style={{ fontSize: 17, fontWeight: 900, color: 'var(--green)' }}>{fmtCFA(modal.amount)}</span>
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>{t('payments.operator')}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['MTN_MOMO', 'ORANGE_MONEY'] as const).map(m => (
                <button key={m} onClick={() => setModal(s => ({ ...s, method: m }))}
                   className="h-10 sm:h-9"
                   style={{ flex: 1, padding: '7px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid', borderColor: modal.method === m ? 'var(--green)' : 'var(--border)', background: modal.method === m ? 'var(--green-light)' : 'var(--surface)', color: modal.method === m ? 'var(--green)' : 'var(--text3)', transition: 'all 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>

                  <Circle size={8} fill={m === 'MTN_MOMO' ? 'var(--amber)' : 'var(--orange)'} stroke="none" />
                  {m === 'MTN_MOMO' ? 'MTN MoMo' : 'Orange Money'}
                </button>
              ))}
            </div>

            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>{t('payments.phoneLabel')}</div>
            <input
              className="h-11 sm:h-9"
              style={{ width: '100%', padding: '7px 10px', borderRadius: 8, fontSize: 13, border: '1.5px solid var(--border)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12, outline: 'none' }}
              type="tel" placeholder={t('payments.phonePlaceholder')} value={modal.phone}
              onChange={e => setModal(m => ({ ...m, phone: e.target.value }))} />

            {modal.error && (
              <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 600, marginBottom: 10 }}>{modal.error}</div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal(m => ({ ...m, open: false }))} disabled={modal.loading}
                className="h-11 sm:h-9"
                style={{ flex: 1, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }}>
                {tc('actions.cancel')}
              </button>
              <button onClick={submitPayment} disabled={modal.loading}
                className="h-11 sm:h-9"
                style={{ flex: 2, padding: '7px 12px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: modal.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: modal.loading ? 0.7 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                {modal.loading ? t('payments.initiating') : <><Smartphone size={13} strokeWidth={2} /> {t('payments.confirmPayment')}</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const sSelect: React.CSSProperties = { padding: '5px 10px', borderRadius: 8, fontSize: 12, border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontFamily: 'inherit', cursor: 'pointer' }
const thSt: React.CSSProperties = { padding: '7px 11px', textAlign: 'left', fontSize: 10.5, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '8px 11px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
const btnPay: React.CSSProperties = { padding: '4px 10px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }

