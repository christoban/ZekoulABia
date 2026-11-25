'use client'
import { useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { HeartPulse, Sparkles, Package, UserCheck } from 'lucide-react'
import type { UserInfo } from '../_types'

interface Props {
  user?: UserInfo | null
}

interface HealthTrackingChild {
  studentId: string
  healthScore: number
  alertLevel: 'critical' | 'warning' | 'good'
  conseil: string | null
  conseilDate: string | null
  // Convocation par le conseiller pédagogique — distincte du conseil santé (contextType séparé
  // côté backend), jamais mélangée : une convocation ne doit jamais masquer le dernier vrai
  // conseil pédagogique (bug trouvé en revue de code, corrigé côté AIController.getHealthTracking).
  convocation: { message: string; date: string } | null
}

export default function SectionStudentHealthTracking({ user }: Props) {
  const t = useT('student')
  const tcommon = useT('common')

  const cacheKey = user ? `student:health-tracking:${user.id}` : ''
  const fetchFn = useCallback(async (): Promise<HealthTrackingChild | null> => {
    const res = await fetchApi('/api/v2/ai/health-tracking', { credentials: 'include' }).then(r => r.json())
    const children = res.children ?? []
    return children[0] ?? null
  }, [user])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<HealthTrackingChild | null>(cacheKey, fetchFn)

  if (loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{t('health_tracking.loading')}</div>
      </div>
    )
  }

  if (error && error !== 'OFFLINE_NO_CACHE') {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{t('health_tracking.load_error')}</div>
          <button onClick={refetch}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('health_tracking.retry')}
          </button>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ marginBottom: 12 }}>
          <div style={sTitle}>{t('health_tracking.title')}</div>
          <div style={sSub}>{t('health_tracking.subtitle')}</div>
        </div>
        <div className="rounded-xl border p-8 text-center w-full max-w-md" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><HeartPulse size={34} color="var(--text3)" /></div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('health_tracking.empty_title')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 500 }}>{t('health_tracking.empty_sub')}</div>
        </div>
      </div>
    )
  }

  const color = data.alertLevel === 'critical' ? 'var(--red)' : data.alertLevel === 'warning' ? 'var(--amber)' : 'var(--green)'
  const bg = data.alertLevel === 'critical' ? 'var(--red-light)' : data.alertLevel === 'warning' ? 'var(--amber-light)' : 'var(--green-light)'
  const levelLabel = data.alertLevel === 'critical' ? t('health_tracking.level_critical') : data.alertLevel === 'warning' ? t('health_tracking.level_warning') : t('health_tracking.level_good')

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: fromCache ? 6 : 12 }}>
        <div style={sTitle}>{t('health_tracking.title')}</div>
        <div style={sSub}>{t('health_tracking.subtitle')}</div>
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
            <Package size={13} strokeWidth={2} /> {tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
          </div>
        )}
      </div>

      {data.convocation && (
        <div className="rounded-xl border p-3.5 sm:p-4 w-full max-w-lg shadow-xs" style={{ background: 'var(--blue-light)', borderColor: 'var(--blue)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 800, color: 'var(--blue)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            <UserCheck size={13} strokeWidth={2} /> {t('health_tracking.convocation_title')}
          </div>
          <div style={{ fontSize: 12.5, color: 'var(--text)', fontWeight: 600, lineHeight: 1.5 }}>{data.convocation.message}</div>
        </div>
      )}

      <div className="rounded-2xl border p-4 sm:p-5 w-full max-w-lg shadow-xs" style={{ background: 'var(--surface)', borderColor: data.alertLevel === 'critical' ? 'var(--red)' : 'var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: data.conseil ? 14 : 0 }}>
          <div style={{ width: 54, height: 54, borderRadius: '50%', background: bg, border: `2.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color, flexShrink: 0 }}>
            {data.healthScore}
          </div>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 3 }}>{t('health_tracking.score_label')}</div>
            <span style={{ background: bg, color, padding: '3px 10px', borderRadius: 16, fontSize: 12, fontWeight: 800, display: 'inline-block' }}>{levelLabel}</span>
          </div>
        </div>

        {data.conseil ? (
          <div className="rounded-xl p-3 sm:p-3.5" style={{ background: 'var(--bg2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
              <Sparkles size={12} strokeWidth={2} /> {t('health_tracking.advice_title')}
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.5 }}>{data.conseil}</div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{t('health_tracking.no_advice')}</div>
        )}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
