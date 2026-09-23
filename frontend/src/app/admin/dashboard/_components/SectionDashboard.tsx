'use client'
import { useState, useCallback, useMemo } from 'react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import {
  GraduationCap, Presentation, CheckCircle2, FileText, RefreshCw, AlertTriangle,
  Users, User, ScrollText, Package, Clock, ShieldAlert, ArrowRight, UserPlus,
  Filter, CheckSquare, TrendingUp, AlertCircle, Award
} from 'lucide-react'

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

type RoleFilter = 'ALL' | 'DIRECTION' | 'CENSEUR' | 'INTENDANCE' | 'SECRETARIAT'

export default function SectionDashboard({ onNav, onInvite, onToast }: Props) {
  const t = useT('admin')
  const [activityRoleFilter, setActivityRoleFilter] = useState<RoleFilter>('ALL')

  const fetchStatsFn = useCallback(async (): Promise<DashStats> => {
    const res = await fetchApi('/api/v2/dashboard/stats', { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Erreur serveur')
    return data.stats
  }, [])

  const { data: stats, loading, error, fromCache, cachedAt, refetch: fetchStats } = useCachedFetch<DashStats>('admin:dashboard-stats', fetchStatsFn)

  const kpi = stats ? [
    { icon: <GraduationCap size={22} strokeWidth={2} />, bg: 'var(--blue-light)', val: String(stats.totalStudents ?? 0), label: t('dashboard.kpi.students'), trendBg: 'var(--green-light)', trendColor: 'var(--green)', nav: 'users' },
    { icon: <Presentation size={22} strokeWidth={2} />, bg: 'var(--amber-light)', val: String(stats.totalTeachers ?? 0), label: t('dashboard.kpi.teachers'), trendBg: 'var(--amber-light)', trendColor: 'var(--amber)', nav: 'users' },
    { icon: <CheckCircle2 size={22} strokeWidth={2} />, bg: 'var(--green-light)', val: stats.avgAttendance || '0%', label: t('dashboard.kpi.attendance_rate'), trendBg: 'var(--green-light)', trendColor: 'var(--green)', nav: 'attendance' },
    { icon: <FileText size={22} strokeWidth={2} />, bg: 'var(--orange-light)', val: String(stats.activeExams ?? 0), label: t('dashboard.kpi.active_exams'), trendBg: 'var(--orange-light)', trendColor: 'var(--orange)', nav: 'academic-events' },
  ] : []

  // Filtrage du flux d'activité par rôle
  const filteredActivity = useMemo(() => {
    if (!stats?.recentActivity) return []
    if (activityRoleFilter === 'ALL') return stats.recentActivity

    return stats.recentActivity.filter(act => {
      const lower = act.toLowerCase()
      if (activityRoleFilter === 'DIRECTION') {
        return lower.includes('bulletin') || lower.includes('décision') || lower.includes('clôture') || lower.includes('validation')
      }
      if (activityRoleFilter === 'CENSEUR') {
        return lower.includes('note') || lower.includes('absence') || lower.includes('cours') || lower.includes('retard') || lower.includes('cahier')
      }
      if (activityRoleFilter === 'INTENDANCE') {
        return lower.includes('paiement') || lower.includes('dépense') || lower.includes('frais') || lower.includes('comptab')
      }
      if (activityRoleFilter === 'SECRETARIAT') {
        return lower.includes('inscription') || lower.includes('dossier') || lower.includes('élève') || lower.includes('carte') || lower.includes('matricule')
      }
      return true
    })
  }, [stats?.recentActivity, activityRoleFilter])

  return (
    <div className="px-4 py-4 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header & Bandeau Tour de Contrôle */}
      <div className="space-y-3 mb-5">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div className="text-[15px] md:text-[17px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
              {t('dashboard.overview_title')} — Tour de Contrôle
            </div>
            <div className="text-[11px] md:text-[12px]" style={{ color: 'var(--text3)', marginTop: 2 }}>{t('dashboard.overview_subtitle')}</div>
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

        {/* Banner Proviseur / Direction */}
        <div className="bg-[var(--sidebar-bg)] border border-[var(--sidebar-border)] rounded-xl p-3.5 text-xs text-[var(--sidebar-text-muted)] flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent/10 text-accent flex-shrink-0">
              <Clock size={16} />
            </div>
            <div>
              <p className="font-bold text-[var(--sidebar-text)] text-xs">Tour de Contrôle & Decision Hub</p>
              <p className="text-[var(--sidebar-text-muted)] text-[11.5px]">Vue synthétique réservée à l'Administrateur / Chef d'Établissement. Les tâches métier directes sont portées par le Staff (Censeur, Intendant, Secrétariat).</p>
            </div>
          </div>
        </div>
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
          {/* Bloc 1: KPIs de Santé d'Établissement */}
          <div className="grid grid-cols-2 sm:grid-cols-4" style={{ gap: 12, marginBottom: 16 }}>
            {kpi.map((k, i) => (
              <div key={i}
                onClick={() => k.nav && onNav(k.nav)}
                className="p-4 md:px-[20px] md:py-[16px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]"
                style={{ background: 'var(--surface)', borderRadius: 12, cursor: k.nav ? 'pointer' : 'default', transition: 'all 0.15s' }}
                onMouseEnter={e => k.nav && Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 6px 20px rgba(0,0,0,0.07)' })}
                onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div className="w-[32px] h-[32px] md:w-10 md:h-10 [&>svg]:w-[15px] [&>svg]:h-[15px] md:[&>svg]:w-[18px] md:[&>svg]:h-[18px]" style={{ borderRadius: 10, background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</div>
                </div>
                <div className="text-[22px] md:text-[28px] font-bold md:font-black" style={{ color: 'var(--text)', lineHeight: 1 }}>{k.val}</div>
                <div className="text-[12px] md:text-[13px]" style={{ color: 'var(--text3)', marginTop: 4, fontWeight: 600 }}>{k.label}</div>
              </div>
            ))}
          </div>

          {/* Bloc 2: Files de Validation d'Urgence (Decisions Pending) */}
          <div className="mb-4 p-4 rounded-xl border border-[var(--border)]" style={{ background: 'var(--surface)' }}>
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--border)]">
              <div className="flex items-center gap-2">
                <ShieldAlert size={18} className="text-amber-500 dark:text-amber-300" />
                <span className="font-extrabold text-[14px] text-[var(--text)]">Files de Décision & Validations d'Urgence</span>
              </div>
              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-300">Supervision Directoriale</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div
                onClick={() => onNav('bulletin-validation')}
                className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:border-amber-500/50 cursor-pointer transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-300">
                    <ScrollText size={16} />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--text)]">Validation Bulletins</div>
                    <div className="text-[11px] text-[var(--text3)]">Vérification & Signature</div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[var(--text3)]" />
              </div>

              <div
                onClick={() => onNav('eleve-onboarding')}
                className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:border-amber-500/50 cursor-pointer transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-300">
                    <UserPlus size={16} />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--text)]">Validation Inscriptions</div>
                    <div className="text-[11px] text-[var(--text3)]">Dossiers hors concours</div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[var(--text3)]" />
              </div>

              <div
                onClick={() => onNav('entrance-exams')}
                className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:border-amber-500/50 cursor-pointer transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300">
                    <Award size={16} />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--text)]">Concours d&apos;Entrée</div>
                    <div className="text-[11px] text-[var(--text3)]">Sessions & seuils d&apos;admissibilité</div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[var(--text3)]" />
              </div>

              <div
                onClick={() => onNav('finance')}
                className="p-3 rounded-lg border border-[var(--border)] bg-[var(--bg)] hover:border-amber-500/50 cursor-pointer transition-all flex items-center justify-between"
              >
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-md bg-success/10 text-success">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-[var(--text)]">Supervision Financière</div>
                    <div className="text-[11px] text-[var(--text3)]">Lecture seule & audits</div>
                  </div>
                </div>
                <ArrowRight size={14} className="text-[var(--text3)]" />
              </div>
            </div>
          </div>

          {/* Bloc 3: 2 colonnes — Flux d'activité filtrable & Navigation Rapide */}
          <div className="grid grid-cols-1 md:[grid-template-columns:2fr_1fr]" style={{ gap: 12 }}>

            {/* Activité récente avec filtre par rôle */}
            <div className="shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)', borderRadius: 12, overflow: 'hidden' }}>
              <div className="px-[18px] pt-[14px] pb-2 md:px-[18px] md:py-3 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                <span className="text-[14px] md:text-[15px] font-bold md:font-extrabold" style={{ color: 'var(--text)' }}>
                  {t('dashboard.recent_activity_title')}
                </span>
                
                {/* Filtres par rôle */}
                <div className="flex items-center gap-1 bg-[var(--bg2)] p-1 rounded-lg text-[11px] font-semibold max-w-full overflow-x-auto no-scrollbar">
                  <Filter size={11} className="text-[var(--text3)] ml-1 flex-shrink-0" />
                  {(['ALL', 'DIRECTION', 'CENSEUR', 'INTENDANCE', 'SECRETARIAT'] as RoleFilter[]).map(r => (
                    <button
                      key={r}
                      onClick={() => setActivityRoleFilter(r)}
                      className={`px-2 py-0.5 rounded-md transition-all border-0 cursor-pointer whitespace-nowrap flex-shrink-0 ${
                        activityRoleFilter === r
                          ? 'bg-[var(--surface)] text-[var(--text)] shadow-xs font-bold'
                          : 'bg-transparent text-[var(--text3)] hover:text-[var(--text2)]'
                      }`}
                    >
                      {r === 'ALL' ? 'Tous' : r.charAt(0) + r.slice(1).toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="px-[18px] pb-[18px] pt-0 md:px-[18px] md:py-[14px]">
                {filteredActivity.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-6" style={{ color: 'var(--text3)', textAlign: 'center' }}>
                    <Clock size={26} strokeWidth={1.6} style={{ color: 'var(--border2)' }} />
                    <span className="text-[12px] md:text-[13px]">
                      {activityRoleFilter === 'ALL' ? t('dashboard.no_recent_activity') : `Aucune activité récente trouvée pour le filtre ${activityRoleFilter}.`}
                    </span>
                  </div>
                ) : (
                  filteredActivity.map((act, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 0', borderBottom: i < filteredActivity.length - 1 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', flexShrink: 0 }} />
                      <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>{act}</span>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Actions rapides orientées Direction / Pilotage */}
            <div className="shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]" style={{ background: 'var(--surface)', borderRadius: 12, overflow: 'hidden' }}>
              <div className="px-[18px] pt-[18px] pb-2 md:px-[18px] md:py-3 md:border-b md:border-[var(--border)]">
                <span className="text-[14px] md:text-[15px] font-bold md:font-extrabold" style={{ color: 'var(--text)' }}>Pilotage & Supervision</span>
              </div>
              <div className="px-[10px] pb-[10px] pt-[6px] gap-[6px] md:px-[14px] md:pb-3 md:pt-0 md:gap-[8px]" style={{ display: 'flex', flexDirection: 'column' }}>
                {[
                  { icon: <Presentation size={14} strokeWidth={2} />, label: 'Hub Organisation Pédagogique', nav: 'org-pedagogy' },
                  { icon: <FileText size={14} strokeWidth={2} />, label: 'Supervision & Validation bulletins', nav: 'bulletin-validation' },
                  { icon: <Package size={14} strokeWidth={2} />, label: 'Pilotage Financier', nav: 'finance' },
                ].map((btn, i) => (
                  <button key={i}
                    onClick={() => onNav(btn.nav)}
                    className="w-full rounded-[10px] md:rounded-[8px] py-[10px] px-[10px] md:py-[8px] md:px-4 text-[12px] md:text-[13px] font-semibold md:font-extrabold gap-[10px] md:gap-2 border-0 md:border md:border-[1.5px] md:border-[var(--border2)] bg-transparent md:bg-[var(--surface)]"
                    style={{ color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', transition: 'all 0.12s' }}
                    onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--green)', color: 'var(--green)' })}
                    onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { borderColor: 'var(--border2)', color: 'var(--text2)' })}
                  >
                    <span className="w-[30px] h-[30px] md:w-auto md:h-auto flex items-center justify-center rounded-[8px] md:rounded-none flex-shrink-0 bg-[var(--bg2)] md:bg-transparent">{btn.icon}</span>
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
