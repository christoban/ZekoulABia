'use client'

import {
  Hand, RefreshCw, GraduationCap, Banknote, CheckCircle2,
  KeyRound, BookOpen, Package, type LucideIcon,
} from 'lucide-react'
import type { StaffSection, SessionUser } from '../_types'
import { getStaffDisplayTitle } from '../_types'
import { useT, useLanguage } from '@/lib/i18n'
import { useStaffDashboardData } from './staffDashboard/useStaffDashboardData'
import StaffSecretarySection from './staffDashboard/StaffSecretarySection'
import StaffCenseurSection from './staffDashboard/StaffCenseurSection'

interface Props {
  sessionUser: SessionUser | null
  allowedSections: Set<StaffSection>
  onNav: (s: StaffSection) => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

export default function SectionStaffDashboard({ sessionUser, allowedSections, onNav, onToast }: Props) {
  const t = useT('staff')
  const { lang } = useLanguage()
  const displayRoleTitle = getStaffDisplayTitle(sessionUser, lang)
  const can = (s: StaffSection) => allowedSections.has(s)
  const isSecretary = can('inscriptions') || (sessionUser?.staffTitle?.toLowerCase().includes('secr') ?? false)
  const isCenseur = !isSecretary && (
    can('timetable') || can('classes') || can('affectations') ||
    (sessionUser?.staffTitle?.toLowerCase().includes('censeur') ?? false) ||
    (sessionUser?.staffTitle?.toLowerCase().includes('vice') ?? false)
  )

  const { kpi, loading, fromCache, cachedAt, refetch, censeur, admissions } = useStaffDashboardData({
    allowedSections,
    isSecretary,
    isCenseur,
  })

  const nomAffiche = sessionUser?.firstName ?? 'Staff'

  const kpiCards = [
    can('council')    && !isCenseur && { icon: GraduationCap, bg: 'var(--purple-light)', val: String(kpi.openCouncils),    label: t('dashboard.openCouncils'),     trend: t('dashboard.toProcess'), tBg: 'var(--purple-light)', tC: 'var(--purple)', nav: 'council' as StaffSection },
    can('finance')    && !isCenseur && { icon: Banknote,      bg: 'var(--blue-light)',   val: String(kpi.pendingInvoices), label: t('dashboard.pendingPayments'),  trend: 'Finances',               tBg: 'var(--blue-light)',   tC: 'var(--blue)',   nav: 'finance' as StaffSection },
    can('attendance') &&               { icon: CheckCircle2,  bg: 'var(--green-light)',  val: kpi.attendanceRate ?? '—',   label: t('dashboard.attendanceRate'),   trend: t('dashboard.today'),     tBg: 'var(--green-light)',  tC: 'var(--green)',  nav: 'attendance' as StaffSection },
    can('library')    && !isCenseur && { icon: BookOpen,      bg: 'var(--red-light)',    val: String(kpi.overdueBooks),    label: t('dashboard.overdueBooks'),     trend: kpi.overdueBooks > 0 ? t('dashboard.urgent') : t('dashboard.upToDate'), tBg: kpi.overdueBooks > 0 ? 'var(--red-light)' : 'var(--green-light)', tC: kpi.overdueBooks > 0 ? 'var(--red)' : 'var(--green)', nav: 'library' as StaffSection },
  ].filter(Boolean) as { icon: LucideIcon; bg: string; val: string; label: string; trend: string; tBg: string; tC: string; nav: StaffSection }[]

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 overflow-y-auto h-full space-y-3.5 sm:space-y-4">
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <div className="flex items-center gap-2 text-base md:text-lg font-extrabold text-[var(--text)]">
            {t('dashboard.greeting')}, {nomAffiche} <Hand size={18} strokeWidth={2} />
          </div>
          <div className="text-xs md:text-[13px] text-[var(--text3)] mt-0.5">2025–2026 · {displayRoleTitle}</div>
          {fromCache && cachedAt && (
            <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 6 }}>
              <Package size={13} strokeWidth={2} /> {t('dashboard.cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button
          className="min-h-[38px] px-3 py-1.5 md:px-3.5 md:py-2 rounded-lg text-xs md:text-[13px] font-bold inline-flex items-center gap-1.5 cursor-pointer font-inherit transition-all"
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

      {!loading && isSecretary && (
        <StaffSecretarySection admissions={admissions} onNav={onNav} />
      )}

      {!loading && isCenseur && (
        <StaffCenseurSection censeur={censeur} onNav={onNav} />
      )}

      {/* KPIS ET ALERTES CLASSIQUES (Pédagogie / Finance / Bibliothèque) */}
      {!loading && kpiCards.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="text-xs font-bold text-[var(--text3)] uppercase tracking-wider">
            Indicateurs de fonctionnement
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3">
            {kpiCards.map((k, i) => (
              <div
                key={i}
                onClick={() => onNav(k.nav)}
                className="p-3 md:p-4 cursor-pointer transition-all duration-150 rounded-xl border border-[var(--border)] bg-[var(--surface)] hover:shadow-md"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: k.bg }}>
                    <k.icon size={15} strokeWidth={2} />
                  </div>
                  <span className="text-[10px] md:text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: k.tBg, color: k.tC }}>
                    {k.trend}
                  </span>
                </div>
                <div className="text-xl md:text-2xl font-black text-[var(--text)]">{k.val}</div>
                <div className="text-xs text-[var(--text3)] mt-0.5 font-semibold truncate">{k.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* État vide si aucune permission */}
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
