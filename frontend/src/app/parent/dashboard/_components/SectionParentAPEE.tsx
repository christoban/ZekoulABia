'use client'
import { useCallback, useEffect } from 'react'
import { HandCoins, CheckCircle2, Clock, Package } from 'lucide-react'
import type { Toast } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: Toast['type']) => void
}

interface Transaction {
  id: string
  type: 'COLLECTE' | 'DEPENSE'
  montant: number
  categorie: string | null
  description: string | null
  date: string
  valide: boolean
}

interface Solde {
  totalCollectes: number
  totalDepenses: number
  solde: number
}

function fmtCFA(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

function chipStyle(bg: string, color: string): React.CSSProperties {
  return { background: bg, color, borderRadius: 12, padding: '3px 8px', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }
}

interface ApeeData { solde: Solde | null; transactions: Transaction[] }

export default function SectionParentAPEE({ onToast }: Props) {
  const t = useT('parent')

  const fetchFn = useCallback(async (): Promise<ApeeData> => {
    const [rSolde, rTx] = await Promise.all([
      fetchApi('/api/v2/apee/solde', { credentials: 'include' }),
      fetchApi('/api/v2/apee/transactions', { credentials: 'include' }),
    ])
    const dSolde = await rSolde.json()
    const dTx = await rTx.json()
    if (!dSolde.success || !dTx.success) throw new Error(t('apee.loadError'))
    return { solde: dSolde.data, transactions: dTx.data }
  }, [t])

  const { data, loading, error, fromCache, cachedAt } = useCachedFetch<ApeeData>('parent-apee', fetchFn)
  const solde = data?.solde ?? null
  const transactions = data?.transactions ?? []

  useEffect(() => {
    if (error && error !== 'OFFLINE_NO_CACHE' && !data) onToast(t('apee.loadError'), 'error')
  }, [error, data, onToast, t])

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  return (
    <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }}>{t('apee.title')}</div>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginTop: 2 }}>{t('apee.subtitle')}</div>
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
            <Package size={13} strokeWidth={2} /> {t('cacheBadge').replace('{date}', new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}
          </div>
        )}
      </div>

      {solde && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[
            { label: t('apee.totalCollectes'), value: fmtCFA(solde.totalCollectes), color: 'var(--green)' },
            { label: t('apee.totalDepenses'), value: fmtCFA(solde.totalDepenses), color: 'var(--red)' },
            { label: t('apee.solde'), value: fmtCFA(solde.solde), color: 'var(--blue)' },
          ].map((k) => (
            <div key={k.label} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', padding: '10px 14px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase' }}>{k.label}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: k.color, marginTop: 4 }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{t('apee.history')}</div>
        {loading ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('apee.loading')}</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('apee.noTransactions')}</div>
        ) : (
          <div>
            {transactions.map((tx) => (
              <div key={tx.id} style={{ padding: '9px 14px', borderBottom: '1px solid var(--bg2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <HandCoins size={14} color="var(--text3)" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={chipStyle(tx.type === 'COLLECTE' ? 'var(--green-light)' : 'var(--red-light)', tx.type === 'COLLECTE' ? 'var(--green)' : 'var(--red)')}>
                      {tx.type === 'COLLECTE' ? t('apee.typeCollecte') : t('apee.typeDepense')}
                    </span>
                    <span style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)' }}>{fmtCFA(tx.montant)}</span>
                    {tx.valide ? (
                      <span style={chipStyle('var(--green-light)', 'var(--green)')}><CheckCircle2 size={11} /> {t('apee.validated')}</span>
                    ) : (
                      <span style={chipStyle('var(--amber-light)', 'var(--amber)')}><Clock size={11} /> {t('apee.pending')}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>
                    {tx.categorie || '—'} {tx.description ? `· ${tx.description}` : ''} · {new Date(tx.date).toLocaleDateString('fr-FR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

