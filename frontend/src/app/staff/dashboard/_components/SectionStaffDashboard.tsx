'use client'
import { useCallback } from 'react'
import { Hand, RefreshCw, FileText, GraduationCap, Smartphone, Banknote, CheckCircle2, KeyRound, BookOpen, Package, type LucideIcon } from 'lucide-react'
import type { StaffSection, SessionUser } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { useT } from '@/lib/i18n'

interface Props {
  sessionUser: SessionUser | null
  allowedSections: Set<StaffSection>
  onNav: (s: StaffSection) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface KpiData {
  openCouncils: number
  pendingInvoices: number
  attendanceRate: string | null
  overdueBooks: number
}

export default function SectionStaffDashboard({ sessionUser, allowedSections, onNav, onToast }: Props) {
  const t = useT('staff')
  const can = (s: StaffSection) => allowedSections.has(s)

  const fetchKpis = useCallback(async (): Promise<KpiData> => {
    const results = await Promise.allSettled([
      can('council')    ? fetchApi('/api/v2/class-councils',                { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('finance')    ? fetchApi('/api/v2/finance/invoices?status=PENDING&limit=1', { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('attendance') ? fetchApi('/api/v2/attendance/stats',              { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
      can('library')    ? fetchApi('/api/v2/library/loans?status=OVERDUE&limit=1', { credentials: 'include' }).then(r => r.json()) : Promise.resolve(null),
    ])

    const [councilRes, financeRes, attendanceRes, libraryRes] = results

    return {
      openCouncils:    councilRes.status === 'fulfilled'   && councilRes.value?.sessions  != null ? councilRes.value.sessions.filter((s: any) => s.status !== 'LOCKED').length : 0,
      pendingInvoices: financeRes.status === 'fulfilled'   && financeRes.value?.pagination != null ? financeRes.value.pagination.total : 0,
      attendanceRate:  attendanceRes.status === 'fulfilled' && attendanceRes.value?.stats  != null ? attendanceRes.value.stats.attendanceRate : null,
      overdueBooks:    libraryRes.status === 'fulfilled'   && libraryRes.value?.pagination != null ? libraryRes.value.pagination.total : 0,
    }
  }, [allowedSections]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, loading, fromCache, cachedAt, refetch } = useCachedFetch<KpiData>('staff-dashboard-kpis', fetchKpis)
  const kpi: KpiData = data ?? { openCouncils: 0, pendingInvoices: 0, attendanceRate: null, overdueBooks: 0 }

  const nomAffiche = sessionUser?.firstName ?? 'Staff'

  const kpiCards = [
    can('council')    && { icon: GraduationCap, bg: 'var(--purple-light)', val: String(kpi.openCouncils),   label: t('dashboard.openCouncils'),     trend: t('dashboard.toProcess'),         tBg: 'var(--purple-light)', tC: 'var(--purple)', nav: 'council' as StaffSection },
    can('finance')    && { icon: Banknote, bg: 'var(--blue-light)', val: String(kpi.pendingInvoices),label: t('dashboard.pendingPayments'), trend: 'Finances',       tBg: 'var(--blue-light)', tC: 'var(--blue)', nav: 'finance' as StaffSection },
    can('attendance') && { icon: CheckCircle2, bg: 'var(--green-light)', val: kpi.attendanceRate ?? '—',  label: t('dashboard.attendanceRate'),     trend: t('dashboard.today'),        tBg: 'var(--green-light)', tC: 'var(--green)', nav: 'attendance' as StaffSection },
    can('library')    && { icon: BookOpen, bg: 'var(--red-light)', val: String(kpi.overdueBooks),  label: t('dashboard.overdueBooks'),     trend: kpi.overdueBooks > 0 ? t('dashboard.urgent') : t('dashboard.upToDate'), tBg: kpi.overdueBooks > 0 ? 'var(--red-light)' : 'var(--green-light)', tC: kpi.overdueBooks > 0 ? 'var(--red)' : 'var(--green)', nav: 'library' as StaffSection },
  ].filter(Boolean) as { icon: LucideIcon; bg: string; val: string; label: string; trend: string; tBg: string; tC: string; nav: StaffSection }[]

  return (
    <div className="px-4 py-4 md:px-7 md:py-6 overflow-y-auto h-full">
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div className="flex items-center justify-between mb-3.5 md:mb-5 flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 text-base md:text-lg font-extrabold text-[var(--text)]">
            {t('dashboard.greeting')}, {nomAffiche} <Hand size={18} strokeWidth={2} />
          </div>
          <div className="text-xs md:text-[13px] text-[var(--text3)] mt-0.5">{t('dashboard.subtitle')}</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Package size={13} strokeWidth={2} /> {t('dashboard.cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button
          className="px-3 py-1.5 md:px-3.5 md:py-2 rounded-lg text-xs md:text-[13px] font-bold inline-flex items-center gap-1.5 cursor-pointer font-inherit transition-all"
          style={{ border: '1.5px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)' }}
          onClick={() => { refetch(); onToast(t('dashboard.refreshing'), 'info') }}
        >
          <RefreshCw size={13} strokeWidth={2} /> {t('dashboard.refresh')}
        </button>
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div style={{ width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
        </div>
      )}

      {!loading && kpiCards.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 md:gap-3.5 mb-3.5 md:mb-5">
          {kpiCards.map((k, i) => (
            <div key={i}
              onClick={() => onNav(k.nav)}
              className="p-2.5 sm:p-3 md:p-4 cursor-pointer transition-all duration-150"
              style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}
              onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-1px)', boxShadow: '0 4px 14px rgba(0,0,0,0.06)' })}
              onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}>
              <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: k.bg }}>
                  <k.icon size={15} strokeWidth={2} />
                </div>
                <span className="text-[9.5px] sm:text-[10.5px] md:text-[11.5px] font-bold px-1.5 sm:px-2 py-0.5 rounded-full whitespace-nowrap truncate max-w-[65px] sm:max-w-none" style={{ background: k.tBg, color: k.tC }}>
                  {k.trend}
                </span>
              </div>
              <div className="text-xl sm:text-2xl md:text-[26px] font-black leading-tight text-[var(--text)]">{k.val}</div>
              <div className="text-[11px] sm:text-xs md:text-[12.5px] text-[var(--text3)] mt-0.5 font-semibold truncate">{k.label}</div>
            </div>
          ))}
        </div>
      )}

      {!loading && (can('council') || can('finance') || can('library')) && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 16 }}>
          <div className="px-3.5 py-2.5 md:px-4 md:py-3 border-b border-[var(--border)]">
            <span className="text-[13px] md:text-[15px] font-bold text-[var(--text)]">{t('dashboard.quickActions')}</span>
          </div>
          <div className="p-3 md:p-3.5 flex flex-col gap-2 md:gap-2.5">
            {[
              can('council') && kpi.openCouncils > 0   && { icon: GraduationCap, bg: 'var(--purple-light)', color: 'var(--purple)', border: 'rgba(91,33,182,0.2)',  text: t('dashboard.openCouncilsAlert', { count: kpi.openCouncils, s: kpi.openCouncils > 1 ? 's' : '' }), action: () => onNav('council'), btn: t('dashboard.viewCTA') },
              can('finance') && kpi.pendingInvoices > 0 && { icon: Banknote, bg: 'var(--red-light)', color: 'var(--red)', border: 'rgba(220,38,38,0.2)', text: t('dashboard.pendingPaymentsAlert', { count: kpi.pendingInvoices, s: kpi.pendingInvoices > 1 ? 's' : '' }), action: () => onNav('finance'), btn: t('dashboard.processCTA') },
              can('library') && kpi.overdueBooks > 0 && { icon: BookOpen, bg: 'var(--red-light)', color: 'var(--red)', border: 'rgba(220,38,38,0.2)', text: t('dashboard.overdueBooksAlert', { count: kpi.overdueBooks, s: kpi.overdueBooks > 1 ? 's' : '' }), action: () => onNav('library'), btn: t('dashboard.viewCTA') },
            ].filter(Boolean).map((alert, i) => {
              const a = alert as { icon: LucideIcon; bg: string; color: string; border: string; text: string; action: () => void; btn: string }
              return (
                <div key={i} className="flex items-center gap-2.5 md:gap-3 px-3 py-2 md:px-3.5 md:py-2.5 rounded-lg" style={{ background: a.bg, border: `1px solid ${a.border}` }}>
                  <span style={{ color: a.color, display: 'inline-flex', flexShrink: 0 }}><a.icon size={16} strokeWidth={2} /></span>
                  <span className="flex-1 text-xs md:text-[13px] font-bold leading-tight" style={{ color: a.color }}>{a.text}</span>
                  <button onClick={a.action}
                    className="px-2.5 py-1 md:px-3 md:py-1.5 rounded-md text-xs md:text-[12.5px] font-bold cursor-pointer font-inherit flex-shrink-0 transition-all"
                    style={{ background: 'var(--surface)', color: a.color, border: `1px solid ${a.border}` }}>
                    {a.btn}
                  </button>
                </div>
              )
            })}
            {!can('council') && !can('finance') && !can('library') && (
              <div className="text-xs md:text-[13px] text-[var(--text3)] py-1">{t('dashboard.noUrgentActions')}</div>
            )}
          </div>
        </div>
      )}

      {allowedSections.size === 1 && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '28px 20px', textAlign: 'center', maxWidth: 440, margin: '0 auto' }}>
          <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'center', color: 'var(--text3)' }}><KeyRound size={36} strokeWidth={1.75} /></div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}>{t('dashboard.noSectionAssignedTitle')}</div>
          <div className="text-xs md:text-[13px] text-[var(--text3)]" style={{ lineHeight: 1.6 }}>
            {t('dashboard.noSectionAssignedDesc')}
          </div>
        </div>
      )}
    </div>
  )
}
