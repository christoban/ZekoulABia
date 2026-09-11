'use client'
import { useCallback } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { GraduationCap, Presentation, CheckCircle2, FileText, RefreshCw, AlertTriangle, Users, User, ScrollText, Package, Clock } from 'lucide-react'

interface Props {
  onNav: (s: string) => void
  onInvite: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface DashStats {
  totalStudents: number
  totalTeachers: number
  activeExams: number
  avgAttendance: string
  recentActivity: string[]
}

export default function SectionDashboard({ onNav, onInvite, onToast }: Props) {
  const t = useT('admin')

  const fetchStatsFn = useCallback(async (): Promise<DashStats> => {
    const res = await fetchApi('/api/v2/dashboard/stats', { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur serveur')
    return data.stats
  }, [])

  const { data: stats, loading, error, fromCache, cachedAt, refetch: fetchStats } = useCachedFetch<DashStats>('admin:dashboard-stats', fetchStatsFn)

  const kpi = stats ? [
    { icon: <GraduationCap size={16} strokeWidth={2} />, bg: 'var(--blue-light)', val: String(stats.totalStudents), label: t('dashboard.kpi.students'),  trendBg: 'var(--green-light)', trendColor: 'var(--green)', nav: 'users' },
    { icon: <Presentation size={16} strokeWidth={2} />, bg: 'var(--amber-light)', val: String(stats.totalTeachers), label: t('dashboard.kpi.teachers'),       trendBg: 'var(--amber-light)', trendColor: 'var(--amber)', nav: 'users' },
    { icon: <CheckCircle2 size={16} strokeWidth={2} />,   bg: 'var(--green-light)', val: stats.avgAttendance,          label: t('dashboard.kpi.attendance_rate'), trendBg: 'var(--green-light)', trendColor: 'var(--green)' },
    { icon: <FileText size={16} strokeWidth={2} />,   bg: 'var(--orange-light)', val: String(stats.activeExams),    label: t('dashboard.kpi.active_exams'),   trendBg: 'var(--orange-light)', trendColor: 'var(--orange)' },
  ] : []

  return (
    <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <div className="text-[18px] md:text-[20px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
            {t('dashboard.overview_title')}
          </div>
          <div className="text-[12px] md:text-[13px]" style={{ color: 'var(--text3)', marginTop: 2 }}>{t('dashboard.overview_subtitle')}</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
              <Package size={12} strokeWidth={2} /> {t('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button
          onClick={() => { fetchStats(); onToast(t('dashboard.refreshing'), 'info') }}
          className="inline-flex items-center gap-[6px] cursor-pointer font-nunito flex-shrink-0 rounded-full md:rounded-[8px] px-[14px] py-[9px] md:px-[12px] md:py-[6px] text-[12.5px] md:text-[13px] font-semibold md:font-extrabold border-0 md:border md:border-[1.5px] md:border-[var(--border2)] bg-[var(--bg2)] md:bg-[var(--surface)]"
          style={{ color: 'var(--text2)' }}
        ><RefreshCw size={13} strokeWidth={2} />{t('dashboard.refresh')}</button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {/* Error */}
      {!loading && error && error !== 'OFFLINE_NO_CACHE' && (
        <div style={{ background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
          <AlertTriangle size={18} strokeWidth={2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: 'var(--red)', fontSize: 14 }}>{error}</div>
          </div>
          <button onClick={fetchStats}
            style={{ padding: '6px 12px', borderRadius: 8, background: 'var(--surface)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 12 }}>
            {t('dashboard.retry')}
          </button>
        </div>
      )}

      {!loading && error === 'OFFLINE_NO_CACHE' && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '32px 20px', textAlign: 'center', color: 'var(--text3)' }}>
          Aucune donnée en cache — reconnectez-vous pour charger le tableau de bord.
        </div>
      )}

      {/* Content */}
      {!loading && !error && stats && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 8, marginBottom: 12 }}>
            {kpi.map((k, i) => (
              <div key={i}
                onClick={() => k.nav && onNav(k.nav)}
                className="p-3 md:px-3.5 md:py-3 shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]"
                style={{ background: 'var(--surface)', borderRadius: 8, cursor: k.nav ? 'pointer' : 'default', transition: 'all 0.15s' }}
                onMouseEnter={e => k.nav && Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div className="w-7 h-7 md:w-8 md:h-8 [&>svg]:w-[13px] [&>svg]:h-[13px] md:[&>svg]:w-[15px] md:[&>svg]:h-[15px]" style={{ borderRadius: 8, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</div>
                </div>
                <div className="text-[18px] md:text-[22px] font-bold md:font-black" style={{ color: 'var(--text)', lineHeight: 1 }}>{k.val}</div>
                <div className="text-[11px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 4, fontWeight: 600 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* 2 colonnes */}
          <div className="grid grid-cols-1 md:[grid-template-columns:2fr_1fr]" style={{ gap: 10 }}>

            {/* Activité récente */}
            <div className="shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)', borderRadius: 8, overflow: 'hidden' }}>
              <div className="px-3 pt-3 pb-1.5 md:px-3.5 md:py-2 md:border-b md:border-[var(--border)]">
                <span className="text-[12px] md:text-[13px] font-bold md:font-extrabold" style={{ color: 'var(--text)' }}>{t('dashboard.recent_activity_title')}</span>
              </div>
              <div className="px-3 pb-3 pt-0 md:px-3.5 md:py-2.5">
                {stats.recentActivity.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-4 md:block md:py-4" style={{ color: 'var(--text3)', textAlign: 'center' }}>
                    <Clock size={26} strokeWidth={1.6} className="md:hidden" style={{ color: 'var(--border2)' }} />
                    <span className="text-[12px] md:text-[13px]">{t('dashboard.no_recent_activity')}</span>
                  </div>
                ) : (
                  stats.recentActivity.map((act, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: i < stats.recentActivity.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{act}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions rapides */}
            <div className="shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)', borderRadius: 8, overflow: 'hidden' }}>
              <div className="px-3 pt-3 pb-1.5 md:px-3.5 md:py-2 md:border-b md:border-[var(--border)]">
                <span className="text-[12px] md:text-[13px] font-bold md:font-extrabold" style={{ color: 'var(--text)' }}>{t('dashboard.quick_actions_title')}</span>
              </div>
              <div className="px-2.5 pb-2.5 pt-1.5 gap-1.5 md:px-3 md:pb-2.5 md:pt-0 md:gap-1.5" style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  { icon: <FileText size={14} strokeWidth={2} />, label: t('dashboard.quick_actions.pending_grades'),    nav: 'grades'    },
                  { icon: <ScrollText size={14} strokeWidth={2} />, label: t('dashboard.quick_actions.generate_reports'),   nav: 'bulletins' },
                  { icon: <Users size={14} strokeWidth={2} />, label: t('dashboard.quick_actions.manage_classes'),   nav: 'classes'   },
                  { icon: <User size={14} strokeWidth={2} />, label: t('dashboard.quick_actions.invite_user'), action: onInvite },
                ].map((btn, i) => (
                  <button key={i}
                    onClick={() => btn.action ? btn.action() : onNav(btn.nav!)}
                    className="w-full rounded-[8px] md:rounded-[8px] py-2 px-2.5 md:py-1.5 md:px-3 text-[11px] md:text-[12px] font-semibold md:font-extrabold gap-2 md:gap-2 border-0 md:border md:border-[1.5px] md:border-[var(--border2)] bg-transparent md:bg-[var(--surface)]"
                    style={{ color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', transition: 'all 0.12s' }}
                    onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', color: 'var(--green)' })}
                    onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text2)' })}
                  >
                    <span className="w-7 h-7 md:w-auto md:h-auto flex items-center justify-center rounded-[8px] md:rounded-none flex-shrink-0 bg-[var(--bg2)] md:bg-transparent">{btn.icon}</span>
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
