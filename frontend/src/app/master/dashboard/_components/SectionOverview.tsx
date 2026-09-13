import { School, Loader2, Mail, Sparkles, Clock } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Badge from './Badge'
import type { KpiData, ActivityRow } from '../_types'

interface Props {
  kpi: KpiData
  activity: ActivityRow[]
  onInvite: () => void
  onGoToSchools: (tab?: string) => void
  onGoToLogs: () => void
}

export default function SectionOverview({ kpi, activity, onInvite, onGoToSchools, onGoToLogs }: Props) {
  return (
    <div style={{ padding: '16px 20px', overflowY: 'auto', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: '#1a1209' }}>
            Vue d&apos;ensemble
          </div>
          <div style={{ fontSize: 13, color: '#a89478', marginTop: 3 }}>
            Tableau de bord global — {kpi.totalSchools} établissements
          </div>
        </div>
        <button onClick={onInvite} style={btnPrimary}>+ Inviter une école</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 18 }}>
        <KpiCard icon={School} bg="#d1fae5" val={String(kpi.activeSchools)} label="Écoles actives" sub={`dont ${kpi.suspendedCount} suspendue${kpi.suspendedCount > 1 ? 's' : ''}`} trend={kpi.activeSchools > 0 ? `+${kpi.activeSchools}` : '0'} trendBg="#d1fae5" trendColor="#065f46" onClick={() => onGoToSchools('active')} />
        <KpiCard icon={Loader2} bg="#fef3c7" val={String(kpi.pendingSchools)} label="En attente d'approbation" trend="Urgent" trendBg="#fef3c7" trendColor="#92400e" onClick={() => onGoToSchools('pending')} />
        <KpiCard icon={Mail} bg="#dbeafe" val={String(kpi.pendingInvites)} label="Invitations en cours" sub="statut PENDING" trend={kpi.pendingInvites > 0 ? `${kpi.pendingInvites} en attente` : '0'} trendBg={kpi.pendingInvites > 0 ? '#fef3c7' : '#d1fae5'} trendColor={kpi.pendingInvites > 0 ? '#92400e' : '#065f46'} />
        <KpiCard icon={Sparkles} bg="#ede9fe" val={String(kpi.newThisMonth)} label="Nouveaux ce mois" sub="30 derniers jours" trend={kpi.newThisMonth > 0 ? `+${kpi.newThisMonth}` : '0'} trendBg="#d1fae5" trendColor="#065f46" />
      </div>

      <div style={{ background: 'white', borderRadius: 10, border: '1px solid #e8e0d4', overflow: 'hidden', marginBottom: 14 }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e8e0d4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#1a1209', display: 'flex', alignItems: 'center', gap: 8 }}><Clock size={17} /> Activité récente</span>
          <button onClick={onGoToLogs} style={btnSecondarySmall}>Voir tous les logs →</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
            <thead>
              <tr>
                {['Date / Heure', 'Action', 'École concernée', 'Opérateur'].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: '#a89478', background: '#f0ebe3', borderBottom: '1px solid #e8e0d4', textTransform: 'uppercase', letterSpacing: '0.4px', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activity.length === 0 ? (
                <tr><td colSpan={4} style={{ padding: '14px 12px', textAlign: 'center', color: '#a89478', fontSize: 13 }}>Aucune activité récente</td></tr>
              ) : activity.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < activity.length - 1 ? '1px solid #faf7f2' : 'none' }}>
                  <td style={tdStyle}>{row.date}</td>
                  <td style={tdStyle}><Badge type={row.badge}>{row.action}</Badge></td>
                  <td style={tdStyle}><span style={{ fontWeight: 700, color: '#1a1209' }}>{row.school}</span></td>
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
        background: 'white', borderRadius: 10, padding: '18px 16px',
        border: '1px solid #e8e0d4', cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.12s', position: 'relative', overflow: 'hidden'
      }}
      onMouseEnter={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'translateY(-2px)', boxShadow: '0 5px 16px rgba(0,0,0,0.07)', borderColor: '#d4c8b8' })}
      onMouseLeave={e => Object.assign((e.currentTarget as HTMLElement).style, { transform: 'none', boxShadow: 'none', borderColor: '#e8e0d4' })}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={17} strokeWidth={2} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 8px', borderRadius: 12, background: trendBg, color: trendColor }}>
          {trend}
        </span>
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#1a1209', lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: 13, color: '#a89478', marginTop: 4, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: '#a89478', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 9, fontSize: 13, fontWeight: 800,
  background: 'linear-gradient(135deg,#059669,#047857)', color: 'white',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
  boxShadow: '0 2px 8px rgba(5,150,105,0.18)', display: 'inline-flex', alignItems: 'center', gap: 6
}
const btnSecondarySmall: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 800,
  background: 'white', color: '#6b5c45', border: '1px solid #d4c8b8',
  cursor: 'pointer', fontFamily: 'inherit'
}
const tdStyle: React.CSSProperties = { padding: '8px 12px', fontSize: 12, color: '#6b5c45', verticalAlign: 'middle' }
