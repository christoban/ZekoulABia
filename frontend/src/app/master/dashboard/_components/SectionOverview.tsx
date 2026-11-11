import { School, Loader2, Mail, Sparkles, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Badge from './Badge'
import type { KpiData, ActivityRow } from '../_types'
import { useT } from '@/lib/i18n'

interface Props {
  kpi: KpiData
  activity: ActivityRow[]
  onInvite: () => void
  onGoToSchools: (tab?: string) => void
  onGoToLogs: () => void
}

export default function SectionOverview({ kpi, activity, onInvite, onGoToSchools, onGoToLogs }: Props) {
  const t = useT('master')

  return (
    <div style={{ padding: '20px 24px 48px', overflowY: 'auto', height: '100%', boxSizing: 'border-box', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)' }}>
            {t('overview.title')}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 3 }}>
            {t('overview.subtitle', { count: kpi.totalSchools })}
          </div>
        </div>
        <button onClick={onInvite} style={btnPrimary}>{t('overview.invite_btn')}</button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <KpiCard
          icon={School}
          bg="var(--green-light)"
          val={String(kpi.activeSchools)}
          label={t('overview.kpi_active')}
          sub={t('overview.kpi_active_sub', { count: kpi.suspendedCount })}
          trend={kpi.activeSchools > 0 ? `+${kpi.activeSchools}` : '0'}
          trendBg="var(--green-light)"
          trendColor="var(--green2)"
          onClick={() => onGoToSchools('active')}
        />
        <KpiCard
          icon={Loader2}
          bg="#fef3c7"
          val={String(kpi.pendingSchools)}
          label={t('overview.kpi_pending')}
          trend={t('overview.kpi_pending_trend')}
          trendBg="#fef3c7"
          trendColor="#92400e"
          onClick={() => onGoToSchools('pending')}
        />
        <KpiCard
          icon={Mail}
          bg="#dbeafe"
          val={String(kpi.pendingInvites)}
          label={t('overview.kpi_invites')}
          sub={t('overview.kpi_invites_sub')}
          trend={kpi.pendingInvites > 0 ? t('overview.kpi_invites_trend', { count: kpi.pendingInvites }) : '0'}
          trendBg={kpi.pendingInvites > 0 ? '#fef3c7' : 'var(--green-light)'}
          trendColor={kpi.pendingInvites > 0 ? '#92400e' : 'var(--green2)'}
        />
        <KpiCard
          icon={Sparkles}
          bg="#ede9fe"
          val={String(kpi.newThisMonth)}
          label={t('overview.kpi_new')}
          sub={t('overview.kpi_new_sub')}
          trend={kpi.newThisMonth > 0 ? `+${kpi.newThisMonth}` : '0'}
          trendBg="var(--green-light)"
          trendColor="var(--green2)"
        />
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={17} /> {t('overview.recent_activity')}
          </span>
          <button onClick={onGoToLogs} style={btnSecondarySmall}>{t('overview.view_all_logs')}</button>
        </div>

        {/* Mobile cards (< md) */}
        <div className="block md:hidden" style={{ padding: 10 }}>
          {activity.length === 0 ? (
            <div style={{ padding: '14px 12px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
              {t('overview.empty_activity')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {activity.map((row, i) => (
                <div
                  key={i}
                  style={{
                    background: 'var(--bg)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                    <Badge type={row.badge}>{row.action}</Badge>
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{row.date}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, fontSize: 12 }}>
                    <span style={{ fontWeight: 700, color: 'var(--text)' }}>{row.school}</span>
                    <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{row.operator}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop table (>= md) */}
        <div className="hidden md:block" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr>
                {[t('overview.col_date'), t('overview.col_action'), t('overview.col_school'), t('overview.col_operator')].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '14px 12px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('overview.empty_activity')}</td></tr>
              ) : activity.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < activity.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={tdStyle}>{row.date}</td>
                  <td style={tdStyle}><Badge type={row.badge}>{row.action}</Badge></td>
                  <td style={tdStyle}><span style={{ fontWeight: 700, color: 'var(--text)' }}>{row.school}</span></td>
                  <td style={tdStyle}>{row.operator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function KpiCard({ icon: Icon, bg, val, label, sub, trend, trendBg, trendColor, onClick }: {
  icon: LucideIcon; bg: string; val: string; label: string; sub?: string; trend: string; trendBg: string; trendColor: string; onClick?: () => void
}) {
  return (
    <div onClick={onClick}
      style={{
        background: 'var(--surface)', borderRadius: 10, padding: '16px 14px',
        border: '1px solid var(--border)', cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.12s', position: 'relative', overflow: 'hidden'
      }}
      onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 5px 16px rgba(0,0,0,0.07)' })}
      onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none' })}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6, marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a1209', flexShrink: 0 }}>
          <Icon size={17} strokeWidth={2} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: trendBg, color: trendColor, whiteSpace: 'nowrap' }}>
          {trend}
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4, fontWeight: 700 }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 800,
  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 2px 8px rgba(142,42,58,0.18)', display: 'inline-flex', alignItems: 'center', gap: 6
}
const btnSecondarySmall: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800,
  background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)',
  cursor: 'pointer', fontFamily: 'inherit'
}
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: 'var(--text2)', verticalAlign: 'middle' }
