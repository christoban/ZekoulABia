'use client'
import { ClipboardList, Circle, Calendar, GraduationCap, Compass, WifiOff } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { OrientationBadge } from './OrientationPrimitives'
import {
  type AcademicYear,
  type FicheListItem,
  type OrientationStats,
  RISK_LABEL_KEY,
  RISK_STYLE,
  STATUS_LABEL_KEY,
  STATUS_STYLE,
  btnPrim,
  btnSec,
  fmtOrientationDate,
  sSelect,
  sSub,
  sTitle,
} from './orientationTypes'

interface Props {
  isOnline: boolean
  years: AcademicYear[]
  selectedYear: string
  onYearChange: (yearId: string) => void
  statusFilter: string
  onStatusFilterChange: (status: string) => void
  riskFilter: string
  onRiskFilterChange: (risk: string) => void
  stats: OrientationStats | null
  loadingStats: boolean
  fiches: FicheListItem[]
  total: number
  page: number
  loadingList: boolean
  error: string | null
  onOpenCheckpoints: () => void
  onOpenNewFiche: () => void
  onOpenFiche: (id: string) => void
  onPageChange: (page: number) => void
}

export default function OrientationDashboardView({
  isOnline,
  years,
  selectedYear,
  onYearChange,
  statusFilter,
  onStatusFilterChange,
  riskFilter,
  onRiskFilterChange,
  stats,
  loadingStats,
  fiches,
  total,
  page,
  loadingList,
  error,
  onOpenCheckpoints,
  onOpenNewFiche,
  onOpenFiche,
  onPageChange,
}: Props) {
  const t = useT('staff')
  const pages = Math.ceil(total / 20)

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={sTitle}>{t('orientation.title')}</div>
          <div style={sSub}>{t('orientation.subtitle')}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={btnSec} onClick={onOpenCheckpoints}>{t('orientation.checkpointsButton')}</button>
          <button style={btnPrim} onClick={onOpenNewFiche}>{t('orientation.newFiche')}</button>
        </div>
      </div>

      {!isOnline && (
        <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 10, padding: '9px 14px', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><WifiOff size={16} strokeWidth={2} /></span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)' }}>Mode hors-ligne — les nouvelles fiches/entretiens/tests/suivis seront synchronisés à la reconnexion</span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {years.length > 0 && (
          <select value={selectedYear} onChange={e => onYearChange(e.target.value)} style={sSelect}>
            {years.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
          </select>
        )}
        <select value={statusFilter} onChange={e => onStatusFilterChange(e.target.value)} style={sSelect}>
          <option value="">{t('orientation.filterAllStatuses')}</option>
          <option value="OUVERTE">{t('orientation.filterOuverte')}</option>
          <option value="EN_COURS">{t('orientation.filterEnCours')}</option>
          <option value="CLOSE">{t('orientation.filterClose')}</option>
          <option value="TRANSFEREE">{t('orientation.filterTransferee')}</option>
        </select>
        <select value={riskFilter} onChange={e => onRiskFilterChange(e.target.value)} style={sSelect}>
          <option value="">{t('orientation.filterAllRisks')}</option>
          <option value="FAIBLE">{t('orientation.filterFaible')}</option>
          <option value="MOYEN">{t('orientation.filterMoyen')}</option>
          <option value="ELEVE">{t('orientation.filterEleve')}</option>
          <option value="CRITIQUE">{t('orientation.filterCritique')}</option>
        </select>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 12, marginBottom: 18 }}>
        {[
          { icon: <ClipboardList size={16} strokeWidth={2} />, bg: 'var(--green-light)', color: 'var(--green)', val: loadingStats ? '…' : String(stats?.fichesOuvertes ?? 0), label: t('orientation.kpiOpenFiches') },
          { icon: <Circle size={16} fill="var(--red)" stroke="none" />, bg: 'var(--red-light)', color: 'var(--red)', val: loadingStats ? '…' : String((stats?.elevesArisqueEleve ?? 0) + (stats?.elevesArisqueCritique ?? 0)), label: t('orientation.kpiAtRisk') },
          { icon: <Calendar size={16} strokeWidth={2} />, bg: 'var(--blue-light)', color: 'var(--blue)', val: loadingStats ? '…' : String(stats?.entretiensThisMois ?? 0), label: t('orientation.kpiInterviewsThisMonth') },
          { icon: <GraduationCap size={16} strokeWidth={2} />, bg: 'var(--purple-light)', color: 'var(--purple)', val: loadingStats ? '…' : String(stats?.recommandationsEnAttente ?? 0), label: t('orientation.kpiPendingRecommendations') },
        ].map((s, i) => (
          <div key={i} style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', padding: '10px 14px' }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>{s.icon}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2, fontWeight: 600 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text)' }}>{t('orientation.studentsMonitored')}</span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>{t('orientation.totalFiches')}</span>
        </div>

        {loadingList ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{t('orientation.loadingFiches')}</div>
        ) : error ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--red)', fontSize: 13 }}>{error}</div>
        ) : fiches.length === 0 ? (
          <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}><Compass size={32} strokeWidth={1.75} /></div>
            <div style={{ fontSize: 13.5 }}>{t('orientation.noFichesForFilters')}</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg)' }}>
                  {[
                    t('orientation.tableHeaderStudent'),
                    t('orientation.tableHeaderClass'),
                    t('orientation.tableHeaderRisk'),
                    t('orientation.tableHeaderStatus'),
                    t('orientation.tableHeaderInterviews'),
                    t('orientation.tableHeaderUpdated'),
                    t('orientation.tableHeaderActions'),
                  ].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text3)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fiches.map(f => (
                  <tr key={f.id} style={{ borderBottom: '1px solid var(--bg2)' }}>
                    <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                      {f.student.firstName} {f.student.lastName}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)' }}>
                      {f.student.studentProfile?.class?.name ?? '—'}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <OrientationBadge value={f.riskLevel} map={RISK_STYLE} labelMap={RISK_LABEL_KEY} />
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <OrientationBadge value={f.status} map={STATUS_STYLE} labelMap={STATUS_LABEL_KEY} />
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
                      {f._count.entretiens}
                    </td>
                    <td style={{ padding: '8px 12px', fontSize: 11.5, color: 'var(--text3)' }}>
                      {fmtOrientationDate(f.updatedAt)}
                    </td>
                    <td style={{ padding: '8px 12px' }}>
                      <button
                        onClick={() => onOpenFiche(f.id)}
                        style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11.5, fontWeight: 600, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer' }}
                      >
                        {t('orientation.viewFiche')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pages > 1 && (
          <div style={{ padding: '10px 14px', display: 'flex', gap: 6, justifyContent: 'center' }}>
            {Array.from({ length: pages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => onPageChange(p)}
                style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, border: '1px solid', borderColor: p === page ? 'var(--green)' : 'var(--border)', background: p === page ? 'var(--green)' : 'white', color: p === page ? 'white' : 'var(--text3)', cursor: 'pointer' }}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
