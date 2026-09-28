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
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 6 : 12 }}>
        <div style={sTitle}>{t('attendance.title')}</div>
        <div style={sSub}>{t('attendance.subtitleExtended')}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} label={t('cacheBadge')} />}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {list.map((child) => (
          <div key={child.studentId} className="rounded-xl border overflow-hidden shadow-xs" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="px-3.5 py-2.5 sm:px-4 sm:py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <span className="text-xs sm:text-sm font-bold truncate inline-flex items-center gap-2" style={{ color: 'var(--text)' }}>
                <User size={14} strokeWidth={2} className="shrink-0" /> {child.prenom} {child.nom}
              </span>
              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: 'var(--blue-light)', color: 'var(--blue)' }} className="shrink-0">
                {child.classeNom || '—'}
              </span>
            </div>
            <div className="p-3.5 sm:p-4 space-y-3">
              {[
                { label: t('attendance.rate'), val: child.tauxPresence, color: child.tauxPresence >= 90 ? 'var(--green)' : 'var(--amber)' },
                { label: t('attendance.punctuality'), val: child.tauxPonctualite, color: child.tauxPonctualite >= 90 ? 'var(--green)' : 'var(--amber)' },
              ].map((stat, j) => (
                <div key={j} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold" style={{ color: 'var(--text2)' }}>
                    <span>{stat.label}</span>
                    <span style={{ color: stat.color, fontWeight: 800 }}>{stat.val}%</span>
                  </div>
                  <div style={{ height: 6, background: 'var(--bg2)', borderRadius: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${stat.val}%`, background: stat.color, borderRadius: 6, transition: 'width 0.6s' }} />
                  </div>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                {[
                  { label: t('attendance.absentDays'), val: child.joursAbsent, bg: 'var(--red-light)', c: 'var(--red)' },
                  { label: t('attendance.thisMonth'), val: '30 j', bg: 'var(--bg2)', c: 'var(--text2)' },
                ].map((s, j) => (
                  <div key={j} className="rounded-lg p-2.5 text-center" style={{ background: s.bg }}>
                    <div className="text-base sm:text-lg font-black" style={{ color: s.c }}>{s.val}</div>
                    <div className="text-[10.5px] font-bold mt-0.5 truncate" style={{ color: s.c, opacity: 0.85 }}>{s.label}</div>
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
