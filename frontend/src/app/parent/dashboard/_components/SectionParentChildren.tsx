'use client'
import { useCallback } from 'react'
import { Users, Package, Trophy, FileText, CheckCircle2, Smartphone, Sparkles } from 'lucide-react'
import type { ChildWithStats } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'
import OrientationCheckpointParentView from './OrientationCheckpointParentView'

interface Props {
  onNav: (s: string) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  userId?: string
}

interface HealthTrackingChild { studentId: string; conseil: string | null; alertLevel: 'critical' | 'warning' | 'good' }

function HealthBadge({ score }: { score: number }) {
  const t = useT('parent')
  const labels = [
    { min: 86, key: 'progression' },
    { min: 71, key: 'stable' },
    { min: 51, key: 'moyen' },
    { min: 31, key: 'eleve' },
    { min: 0, key: 'critique' },
  ]
  const found = labels.find(l => score >= l.min)!
  const label = t(`health.levels.${found.key}`)
  const color = found.key === 'progression' ? 'var(--green)' : found.key === 'stable' ? 'var(--blue)' : found.key === 'moyen' ? 'var(--amber)' : found.key === 'eleve' ? 'var(--orange)' : 'var(--red)'
  const bg = found.key === 'progression' ? 'var(--green-light)' : found.key === 'stable' ? 'var(--blue-light)' : found.key === 'moyen' ? 'var(--amber-light)' : found.key === 'eleve' ? 'var(--orange-light)' : 'var(--red-light)'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', background: bg, border: `1.5px solid ${color}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 900, color, flexShrink: 0 }}>
        {score}
      </div>
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color }}>{label}</div>
        <div style={{ fontSize: 10.5, color: 'var(--text3)' }}>{t('health.label')}</div>
      </div>
    </div>
  )
}

function CacheBadge({ cachedAt, label }: { cachedAt: number | null; label: string }) {
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
      <Package size={13} strokeWidth={2} /> {label.replace('{date}', date)}
    </div>
  )
}

export default function SectionParentChildren({ onNav, onToast, userId }: Props) {
  const t = useT('parent')
  const cacheKey = userId ? `parent:children:${userId}` : ''
  const fetchFn = useCallback(async () => {
    const res = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
    if (!res.success) throw new Error(t('children.errorLoadChildren'))
    return res.data as ChildWithStats[]
  }, [userId, t])

  const { data: children, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<ChildWithStats[]>(cacheKey, fetchFn)

  const conseilCacheKey = userId ? `parent:health-tracking:${userId}` : ''
  const fetchConseilsFn = useCallback(async (): Promise<HealthTrackingChild[]> => {
    const res = await fetchApi('/api/v2/ai/health-tracking', { credentials: 'include' }).then(r => r.json())
    return res.children ?? []
  }, [userId])
  const { data: conseilsData } = useCachedFetch<HealthTrackingChild[]>(conseilCacheKey, fetchConseilsFn)
  const conseilParEnfant = new Map((conseilsData ?? []).map(c => [c.studentId, c]))

  if (loading) {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{t('loading')}</div>
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  if (error) {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>
          <button onClick={refetch}
            style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
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
          <div style={sTitle}>{t('children.title')}</div>
          <div style={sSub}>{t('children.subtitle')}</div>
        </div>
        {fromCache && <CacheBadge cachedAt={cachedAt} label={t('cacheBadge')} />}
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: 36, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Users size={36} strokeWidth={2} /></div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('children.emptyTitle')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('children.emptyDesc')}</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 6 : 16 }}>
        <div style={sTitle}>{t('children.title')}</div>
        <div style={sSub}>{t('children.subtitleCount').replace('{count}', String(list.length))}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} label={t('cacheBadge')} />}

      <OrientationCheckpointParentView children={list.map(c => ({ studentId: c.studentId, prenom: c.prenom, nom: c.nom }))} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {list.map((child, i) => {
          const avg = child.dernieereMoyenne ?? 0
          const avgColor = avg >= 14 ? 'var(--green)' : avg >= 10 ? 'var(--blue)' : 'var(--red)'
          return (
            <div key={child.studentId}
              style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', transition: 'all 0.15s' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-1px)', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>

              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg,${i === 0 ? 'var(--blue),var(--purple)' : 'var(--primary),var(--accent)'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 14, flexShrink: 0 }}>
                  {child.prenom[0]}{child.nom[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>{child.prenom} {child.nom}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>{t('children.studentLabel').replace('{className}', child.classeNom || '—')}</div>
                </div>
                {child.indiceSante !== undefined && child.indiceSante !== null && (
                  <HealthBadge score={child.indiceSante} />
                )}
              </div>

              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8, marginBottom: 12 }}>
                  {[
                    { label: t('children.latestAverage'), val: `${avg.toFixed(1)}/20`, color: avgColor },
                    { label: t('children.attendanceRate'), val: `${child.tauxPresence}%`, color: child.tauxPresence >= 90 ? 'var(--green)' : 'var(--amber)' },
                    { label: t('children.punctuality'), val: `${child.tauxPonctualite}%`, color: child.tauxPonctualite >= 90 ? 'var(--green)' : 'var(--amber)' },
                  ].map((stat, j) => (
                    <div key={j} style={{ background: 'var(--bg2)', borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: stat.color }}>{stat.val}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Trophy size={13} strokeWidth={2} /> {t('children.mention')} <strong style={{ color: 'var(--text)' }}>{child.derniereeMention || '—'}</strong>
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {t('children.absenceDays').replace('{count}', String(child.joursAbsent))}
                  </span>
                </div>

                {(() => {
                  const conseil = conseilParEnfant.get(child.studentId)
                  if (!conseil?.conseil) return null
                  const color = conseil.alertLevel === 'critical' ? 'var(--red)' : conseil.alertLevel === 'warning' ? 'var(--amber)' : 'var(--green)'
                  return (
                    <div style={{ background: 'var(--bg2)', borderRadius: 8, padding: '10px 12px', marginBottom: 12, borderLeft: `2.5px solid ${color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                        <Sparkles size={12} strokeWidth={2} /> {t('children.aiAdviceTitle')}
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.4 }}>{conseil.conseil}</div>
                    </div>
                  )
                })()}

                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { label: t('children.actionGrades'),  icon: FileText,    action: () => onNav('grades'),    prim: true  },
                    { label: t('children.actionAttendance'),  icon: CheckCircle2, action: () => onNav('attendance'), prim: false },
                    { label: t('children.actionPayments'),  icon: Smartphone,  action: () => onNav('payments'),  prim: false },
                  ].map((btn, j) => (
                    <button key={j} onClick={btn.action}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', border: btn.prim ? 'none' : '1px solid var(--border2)', background: btn.prim ? 'linear-gradient(135deg,var(--primary),var(--primary-hover))' : 'var(--surface)', color: btn.prim ? 'white' : 'var(--text2)', transition: 'all 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                      onMouseEnter={e => { if (!btn.prim) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', color: 'var(--green)' }) }}
                      onMouseLeave={e => { if (!btn.prim) Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text2)' }) }}>
                      <btn.icon size={13} strokeWidth={2} /> {btn.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
