'use client'
import { useCallback } from 'react'
import { Package, CheckCircle2, User } from 'lucide-react'
import type { ChildWithStats } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  userId?: string
}

function CacheBadge({ cachedAt, label }: { cachedAt: number | null; label: string }) {
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
      <Package size={13} strokeWidth={2} /> {label.replace('{date}', date)}
    </div>
  )
}

export default function SectionParentAttendance({ onToast, userId }: Props) {
  const t = useT('parent')
  const cacheKey = userId ? `parent:attendance:${userId}` : ''
  const fetchFn = useCallback(async () => {
    const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
    if (!res.success) throw new Error(t('errorLoad'))
    return res.data as ChildWithStats[]
  }, [userId, t])

  const { data: children, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<ChildWithStats[]>(cacheKey, fetchFn)

  if (loading) {
    return (
      <div style={{ padding: '20px 24px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{t('loading')}</div>
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  if (error) {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>
          <button onClick={refetch}
            style={{ padding: '5px 12px', borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  const list = children ?? []

  if (!list.length) {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={sTitle}>{t('attendance.title')}</div>
          <div style={sSub}>{t('attendance.subtitle')}</div>
        </div>
        {fromCache && <CacheBadge cachedAt={cachedAt} label={t('cacheBadge')} />}
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 32, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><CheckCircle2 size={36} strokeWidth={2} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{t('attendance.emptyTitle')}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 6 : 14 }}>
        <div style={sTitle}>{t('attendance.title')}</div>
        <div style={sSub}>{t('attendance.subtitleExtended')}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} label={t('cacheBadge')} />}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
        {list.map((child) => (
          <div key={child.studentId} style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><User size={14} strokeWidth={2} /> {child.prenom} {child.nom}</span>
              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: 'var(--blue-light)', color: 'var(--blue)' }}>{child.classeNom || '—'}</span>
            </div>
            <div style={{ padding: '12px 14px' }}>
              {[
                { label: t('attendance.rate'), val: child.tauxPresence, color: child.tauxPresence >= 90 ? 'var(--green)' : 'var(--amber)' },
                { label: t('attendance.punctuality'), val: child.tauxPonctualite, color: child.tauxPonctualite >= 90 ? 'var(--green)' : 'var(--amber)' },
              ].map((stat, j) => (
                <div key={j} style={{ marginBottom: j === 0 ? 10 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
                    <span>{stat.label}</span>
                    <span style={{ color: stat.color, fontWeight: 800 }}>{stat.val}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${stat.val}%`, background: stat.color, borderRadius: 6, transition: 'width 0.6s' }} />
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                {[
                  { label: t('attendance.absentDays'), val: child.joursAbsent, bg: 'var(--red-light)', c: 'var(--red)' },
                  { label: t('attendance.thisMonth'), val: '30 j', bg: 'var(--bg2)', c: 'var(--text2)' },
                ].map((s, j) => (
                  <div key={j} style={{ flex: 1, background: s.bg, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: s.c }}>{s.val}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: s.c, opacity: 0.8, marginTop: 2 }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
