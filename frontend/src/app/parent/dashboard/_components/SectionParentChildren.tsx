'use client'
import { useCallback, useState } from 'react'
import { Users, Package, Trophy, FileText, CheckCircle2, Smartphone, Sparkles, BookOpen, Calendar, FileCheck, User } from 'lucide-react'
import type { ChildWithStats } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'
import OrientationCheckpointParentView from './OrientationCheckpointParentView'
import ChildProfileModal from './ChildProfileModal'

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
  const [selectedChildModal, setSelectedChildModal] = useState<ChildWithStats | null>(null)
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
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ overflowY: 'auto', height: '100%' }}>
      <div style={{ marginBottom: fromCache ? 6 : 12 }}>
        <div style={sTitle}>{t('children.title')}</div>
        <div style={sSub}>{t('children.subtitleCount').replace('{count}', String(list.length))}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} label={t('cacheBadge')} />}

      <OrientationCheckpointParentView children={list.map(c => ({ studentId: c.studentId, prenom: c.prenom, nom: c.nom, classeNom: c.classeNom }))} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
        {list.map((child, i) => {
          const avg = child.dernieereMoyenne ?? 0
          const avgColor = avg >= 14 ? 'var(--green)' : avg >= 10 ? 'var(--blue)' : 'var(--red)'
          return (
            <div key={child.studentId}
              className="rounded-xl border overflow-hidden shadow-xs transition-all"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

              <div className="p-3.5 sm:p-4 border-b flex items-center justify-between gap-3" style={{ borderColor: 'var(--border)' }}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div style={{ width: 38, height: 38, borderRadius: 10, background: `linear-gradient(135deg,${i === 0 ? 'var(--blue),var(--purple)' : 'var(--primary),var(--accent)'})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 800, fontSize: 14 }} className="shrink-0">
                    {child.prenom[0]}{child.nom[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm sm:text-base font-bold truncate" style={{ color: 'var(--text)', fontFamily: 'var(--font-spectral),Spectral,serif' }}>
                      {child.prenom} {child.nom}
                    </div>
                    <div className="text-[11.5px] truncate mt-0.5" style={{ color: 'var(--text3)' }}>
                      {t('children.studentLabel').replace('{className}', child.classeNom || '—')}
                      {child.matricule ? ` · ${child.matricule}` : ''}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setSelectedChildModal(child)}
                    title="Consulter le dossier officiel de l'enfant"
                    className="h-8 px-2.5 rounded-lg text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer"
                    style={{
                      background: 'var(--bg2)',
                      borderColor: 'var(--border)',
                      color: 'var(--text2)',
                    }}
                  >
                    <User size={12} style={{ color: 'var(--primary)' }} />
                    <span className="hidden sm:inline">Dossier</span>
                  </button>

                  {child.indiceSante !== undefined && child.indiceSante !== null && (
                    <HealthBadge score={child.indiceSante} />
                  )}
                </div>
              </div>

              <div className="p-3.5 sm:p-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: t('children.latestAverage'), val: `${avg.toFixed(1)}/20`, color: avgColor },
                    { label: t('children.attendanceRate'), val: `${child.tauxPresence}%`, color: child.tauxPresence >= 90 ? 'var(--green)' : 'var(--amber)' },
                    { label: t('children.punctuality'), val: `${child.tauxPonctualite}%`, color: child.tauxPonctualite >= 90 ? 'var(--green)' : 'var(--amber)' },
                  ].map((stat, j) => (
                    <div key={j} className="rounded-lg p-2 text-center" style={{ background: 'var(--bg2)' }}>
                      <div className="text-sm sm:text-base font-extrabold" style={{ color: stat.color }}>{stat.val}</div>
                      <div className="text-[10px] sm:text-[11px] font-semibold mt-1 truncate" style={{ color: 'var(--text3)' }}>{stat.label}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span style={{ color: 'var(--text2)', fontWeight: 600 }} className="inline-flex items-center gap-1.5 truncate">
                    <Trophy size={13} strokeWidth={2} className="shrink-0" /> {t('children.mention')} <strong style={{ color: 'var(--text)' }}>{child.derniereeMention || '—'}</strong>
                  </span>
                  <span className="shrink-0" style={{ color: 'var(--text3)' }}>
                    {t('children.absenceDays').replace('{count}', String(child.joursAbsent))}
                  </span>
                </div>

                {(() => {
                  const conseil = conseilParEnfant.get(child.studentId)
                  if (!conseil?.conseil) return null
                  const color = conseil.alertLevel === 'critical' ? 'var(--red)' : conseil.alertLevel === 'warning' ? 'var(--amber)' : 'var(--green)'
                  return (
                    <div className="rounded-lg p-2.5 sm:p-3" style={{ background: 'var(--bg2)', borderLeft: `3px solid ${color}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                        <Sparkles size={12} strokeWidth={2} /> {t('children.aiAdviceTitle')}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 500, lineHeight: 1.4 }}>{conseil.conseil}</div>
                    </div>
                  )
                })()}

                {/* Boutons d'action tactiles enrichis */}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {[
                    { label: t('children.actionGrades'),     icon: FileText,     action: () => onNav('grades'),    prim: true  },
                    { label: t('children.actionAttendance'), icon: CheckCircle2, action: () => onNav('attendance'),prim: false },
                    { label: 'Devoirs',                     icon: BookOpen,     action: () => onNav('homework'),  prim: false },
                    { label: 'Emploi du temps',             icon: Calendar,     action: () => onNav('timetable'), prim: false },
                    { label: t('children.actionPayments'),   icon: Smartphone,   action: () => onNav('payments'),  prim: false },
                    { label: 'Documents',                   icon: FileCheck,    action: () => onNav('documents'), prim: false },
                  ].map((btn, j) => (
                    <button
                      key={j}
                      onClick={btn.action}
                      className="h-10 sm:h-9 px-2 rounded-xl text-[10.5px] sm:text-xs font-bold cursor-pointer transition-transform active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-xs border"
                      style={{
                        background: btn.prim ? 'linear-gradient(135deg,var(--primary),var(--primary-hover))' : 'var(--surface)',
                        borderColor: btn.prim ? 'transparent' : 'var(--border2)',
                        color: btn.prim ? 'white' : 'var(--text2)',
                      }}
                    >
                      <btn.icon size={13} strokeWidth={2} className="shrink-0" />
                      <span className="truncate">{btn.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {selectedChildModal && (
        <ChildProfileModal
          child={selectedChildModal}
          onClose={() => setSelectedChildModal(null)}
          onToast={onToast}
          onUpdated={refetch}
        />
      )}
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
