'use client'
import { useState, useEffect, useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { AlertTriangle, Lock, Loader2 } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface Payment { id: string; amount: number; status: string; paidAt: string | null }
interface CautionInvoice {
  id: string; amount: number; status: string; createdAt: string
  student: { id: string; firstName: string; lastName: string }
  feePlan: { id: string; name: string } | null
  payments: Payment[]
}

const STATUS_LABEL: Record<string, { bg: string; color: string }> = {
  PENDING:   { bg: 'var(--amber-light)', color: 'var(--amber)' },
  PAID:      { bg: 'var(--green-light)', color: 'var(--green)' },
  CANCELLED: { bg: 'var(--red-light)', color: 'var(--red)' },
  PARTIAL:   { bg: 'var(--amber-light)', color: 'var(--amber)' },
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

export default function SectionCautions({ onToast }: Props) {
  const t = useT('staff')
  const [cautions, setCautions] = useState<CautionInvoice[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)

  const fetchCautions = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetchApi('/api/v2/finance/invoices?feeType=CAUTION&limit=50', { credentials: 'include' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur serveur')
      setCautions(data.data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCautions() }, [fetchCautions])

  const handleRemboursement = async (caution: CautionInvoice) => {
    const cautionPayment = caution.payments.find(p => p.status !== 'PAID')
    if (!cautionPayment) {
      onToast(t('cautions.noEligiblePayment'), 'error')
      return
    }
    if (!confirm(t('cautions.refundConfirm', { firstName: caution.student.firstName, lastName: caution.student.lastName, amount: fmtCFA(caution.amount) }))) return
    setActionId(caution.id)
    try {
      const res = await fetchApi(`/api/v2/finance/payments/caution/${cautionPayment.id}/rembourser`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REMBOURSER' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('cautions.refundSuccess', { firstName: caution.student.firstName, lastName: caution.student.lastName }), 'success')
      fetchCautions()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur de remboursement', 'error')
    } finally {
      setActionId(null)
    }
  }

  const handleRetention = async (caution: CautionInvoice) => {
    if (!confirm(t('cautions.retainConfirm', { firstName: caution.student.firstName, lastName: caution.student.lastName }))) return
    const cautionPayment = caution.payments.find(p => p.status !== 'PAID')
    if (!cautionPayment) { onToast(t('cautions.noPaymentFound'), 'error'); return }
    setActionId(caution.id)
    try {
      const res = await fetchApi(`/api/v2/finance/payments/caution/${cautionPayment.id}/rembourser`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RETENIR_DEFINITIVEMENT' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Erreur')
      onToast(t('cautions.retainSuccess'), 'success')
      fetchCautions()
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erreur', 'error')
    } finally {
      setActionId(null)
    }
  }

  const heldCount   = cautions.filter(c => c.status === 'PENDING' || c.status === 'PARTIAL').length
  const totalAmount = cautions.filter(c => c.status === 'PENDING' || c.status === 'PARTIAL').reduce((s, c) => s + c.amount, 0)

  return (
    <div className="px-4 py-4 md:px-7 md:py-6" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={sTitle}>{t('cautions.title')}</div>
          <div style={sSub}>{t('cautions.subtitle')}</div>
        </div>
        <button style={btnSec} onClick={fetchCautions}>{t('cautions.refresh')}</button>
      </div>

      {!loading && !error && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{t('cautions.kpiPending')}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--amber)' }}>{heldCount}</div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{t('cautions.kpiTotalAmount')}</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)' }}>{fmtCFA(totalAmount)}</div>
          </div>
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>{t('cautions.kpiTotalCautions')}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text2)' }}>{cautions.length}</div>
          </div>
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <div style={{ width: 26, height: 26, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && error && (
        <div style={{ background: 'var(--red-light)', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <span style={{ display: 'inline-flex' }}><AlertTriangle size={15} strokeWidth={2} /></span><span style={{ fontWeight: 600, color: 'var(--red)', flex: 1, fontSize: 12.5 }}>{error}</span>
          <button onClick={fetchCautions} style={btnRetry}>{t('cautions.retry')}</button>
        </div>
      )}

      {!loading && !error && cautions.length === 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '40px 24px', textAlign: 'center' }}>
          <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}><Lock size={36} strokeWidth={1.75} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('cautions.noCautionsTitle')}</div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>{t('cautions.noCautionsDesc')}</div>
        </div>
      )}

      {!loading && !error && cautions.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 650 }}>
              <thead>
                <tr>{[
                  t('cautions.tableHeaderStudent'),
                  t('cautions.tableHeaderAmount'),
                  t('cautions.tableHeaderPlan'),
                  t('cautions.tableHeaderDate'),
                  t('cautions.tableHeaderStatus'),
                  t('cautions.tableHeaderActions'),
                ].map(h => (
                  <th key={h} style={thSt}>{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {cautions.map((c) => {
                  const st = STATUS_LABEL[c.status] ?? { bg: 'var(--bg2)', color: 'var(--text2)' }
                  const statusLabelKey = c.status === 'PENDING' ? 'statusHeldf' : c.status === 'PAID' ? 'statusRefunded' : c.status === 'CANCELLED' ? 'statusRetained' : 'statusPartial'
                  const isHeld = c.status === 'PENDING' || c.status === 'PARTIAL'
                  return (
                    <tr key={c.id}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <td style={{ ...tdSt, fontWeight: 600, color: 'var(--text)' }}>
                        {c.student.firstName} {c.student.lastName}
                      </td>
                      <td style={{ ...tdSt, fontWeight: 600 }}>{fmtCFA(c.amount)}</td>
                      <td style={tdSt}>{c.feePlan?.name ?? 'Caution'}</td>
                      <td style={tdSt}>{new Date(c.createdAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</td>
                      <td style={tdSt}>
                        <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 700, background: st.bg, color: st.color }}>
                          {t(`cautions.${statusLabelKey}`)}
                        </span>
                      </td>
                      <td style={tdSt}>
                        {isHeld && (
                          <div style={{ display: 'flex', gap: 5 }}>
                            <button
                              style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--green-light)', color: 'var(--green)', border: '1px solid rgba(142,42,58,0.25)', cursor: 'pointer', fontFamily: 'inherit' }}
                              onClick={() => handleRemboursement(c)}
                              disabled={actionId === c.id}>
                              {actionId === c.id ? <Loader2 size={12} strokeWidth={2} className="animate-spin" /> : t('cautions.refund')}
                            </button>
                            <button
                              style={{ padding: '4px 9px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.2)', cursor: 'pointer', fontFamily: 'inherit' }}
                              onClick={() => handleRetention(c)}
                              disabled={actionId === c.id}>
                              {t('cautions.retain')}
                            </button>
                          </div>
                        )}
                        {!isHeld && (
                          <span style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>
                            {c.status === 'PAID' ? t('cautions.refunded') : t('cautions.processed')}
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
const btnSec: React.CSSProperties = { padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
const btnRetry: React.CSSProperties = { padding: '4px 10px', borderRadius: 6, fontSize: 12, background: 'var(--surface)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }
const thSt: React.CSSProperties = { padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '8px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
