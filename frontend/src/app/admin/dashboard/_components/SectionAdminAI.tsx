'use client'
import { useState, useEffect, useCallback } from 'react'
import { Siren, AlertTriangle, Eye, CheckCircle2, Star, RefreshCw, X, Bot } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface StudentHealth {
  studentId: string; name: string; className: string
  healthScore: number; alertLevel: 'critical' | 'warning' | 'recommendation' | 'good' | 'excellent'
}

interface HealthSummary { critical: number; warning: number; recommendation: number; good: number; excellent: number }

interface ClassItem { id: string; name: string }

const ALERT_STYLE: Record<string, { bg: string; color: string; icon: LucideIcon }> = {
  critical:       { bg: 'var(--red-light)', color: 'var(--red)', icon: Siren },
  warning:        { bg: 'var(--orange-light)', color: 'var(--orange)', icon: AlertTriangle },
  recommendation: { bg: 'var(--amber-light)', color: 'var(--amber)', icon: Eye },
  good:           { bg: 'var(--blue-light)', color: 'var(--blue)', icon: CheckCircle2 },
  excellent:      { bg: 'var(--green-light)', color: 'var(--green)', icon: Star },
}

interface HealthData { students: StudentHealth[]; summary: HealthSummary | null }

export default function SectionAdminAI({ onToast }: Props) {
  const t = useT('admin')
  const [classes, setClasses]     = useState<ClassItem[]>([])
  const [classFilter, setClassFilter] = useState('')
  const [alertFilter, setAlertFilter] = useState('')

  const fetchClasses = useCallback(async () => {
    try {
      const res = await fetchApi('/api/v2/classes', { credentials: 'include' })
      const d = await res.json()
      if (res.ok) setClasses(d.data || [])
    } catch { /* silencieux */ }
  }, [])

  const fetchHealthFn = useCallback(async (): Promise<HealthData> => {
    const params = new URLSearchParams()
    if (classFilter) params.set('classId', classFilter)
    const res = await fetchApi(`/api/v2/ai/students-health?${params}`, { credentials: 'include' })
    const d = await res.json()
    if (!res.ok) throw new Error(d.message || t('common.error'))
    return { students: d.students || [], summary: d.summary || null }
  }, [classFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<HealthData>(`admin:ai-health:${classFilter}`, fetchHealthFn)
  const students = data?.students ?? []
  const summary = data?.summary ?? null

  useEffect(() => { fetchClasses() }, [fetchClasses])
  useEffect(() => {
    if (error && error !== 'OFFLINE_NO_CACHE' && !data) onToast(error, 'error')
  }, [error, data, onToast])

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  const alertLabel = (key: string) => t(`ai.alert_labels.${key}`)

  const filtered = alertFilter ? students.filter(s => s.alertLevel === alertFilter) : students
  const atRisk   = students.filter(s => s.alertLevel === 'critical' || s.alertLevel === 'warning').length

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ overflowY: 'auto', height: '100%' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
        <div>
          <div className="text-[18px] md:text-[18px]" style={sTitle}>{t('ai.title')}</div>
          <div className="text-[12px] md:text-[13px]" style={sSub}>{t('ai.subtitle')}</div>
          {fromCache && cachedAt && (
            <div className="text-[11.5px] md:text-[12px]" style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '5px 12px', fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
              {t('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
            </div>
          )}
        </div>
        <button
          className="inline-flex items-center gap-[6px] cursor-pointer font-nunito flex-shrink-0 rounded-full md:rounded-[10px] px-[14px] py-[9px] md:px-[16px] md:py-[8px] text-[12.5px] md:text-[13px] font-semibold md:font-extrabold border-0 md:border md:border-[1.5px] md:border-[var(--border2)] bg-[var(--bg2)] md:bg-[var(--surface)]"
          style={{ color: 'var(--text2)' }}
          onClick={refetch}><RefreshCw size={14} /> {t('ai.btn_refresh')}</button>
      </div>

      {summary && !loading && (
        <div className="grid grid-cols-2 sm:grid-cols-5" style={{ gap: 10, marginBottom: 10 }}>
          {(Object.entries(ALERT_STYLE) as [string, typeof ALERT_STYLE[string]][]).map(([key, s]) => {
            const isActive = alertFilter === key
            return (
            <div key={key}
              className={`p-3 md:px-3.5 md:py-3 rounded-[10px] md:rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none md:border md:border-[1.5px] ${isActive ? 'border-[1.5px]' : 'border-0'}`}
              style={{ background: 'var(--surface)', borderStyle: 'solid', borderColor: isActive ? 'var(--green)' : 'var(--border)', cursor: 'pointer', transition: 'all 0.15s' }}
              onClick={() => setAlertFilter(isActive ? '' : key)}>
              <div className="w-7 h-7 md:w-8 md:h-8" style={{ borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}><s.icon size={16} color={s.color} /></div>
              <div className="text-[18px] md:text-[18px] font-bold md:font-black" style={{ color: s.color }}>{summary[key as keyof HealthSummary]}</div>
              <div className="text-[12px] md:text-[12px]" style={{ color: 'var(--text3)', fontWeight: 600, marginTop: 3 }}>{alertLabel(key)}</div>
            </div>
            )
          })}
        </div>
      )}

      {atRisk > 0 && !loading && (
        <div className="text-[13px] md:text-[13px] px-[14px] py-[12px] md:px-3.5 md:py-2.5" style={{ background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 8, marginBottom: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Siren size={15} color="var(--red)" />
          <span style={{ fontWeight: 700, color: 'var(--red)' }}>
            {t(atRisk > 1 ? 'ai.at_risk_other' : 'ai.at_risk_one').replace('{count}', String(atRisk))}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginBottom: 13, flexWrap: 'wrap' }}>
        <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="text-[13px] md:text-[13px] px-[11px] py-[7px] md:px-[12px] md:py-[8px]" style={{ ...filterSt }}>
          <option value="">{t('ai.filter_all_classes')}</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {alertFilter && (
          <button onClick={() => setAlertFilter('')} className="text-[12.5px] md:text-[12px] px-[12px] py-[7px] md:px-[14px] md:py-[8px]" style={{ borderRadius: 8, fontWeight: 700, background: 'var(--red-light)', color: 'var(--red)', border: '1px solid rgba(220,38,38,0.3)', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <X size={14} /> {alertLabel(alertFilter)}
          </button>
        )}
        <span className="text-[12.5px] md:text-[12px]" style={{ marginLeft: 'auto', color: 'var(--text3)', fontWeight: 600, alignSelf: 'center' }}>
          {t(filtered.length > 1 ? 'ai.students_count_other' : 'ai.students_count_one').replace('{count}', String(filtered.length))}
        </span>
      </div>

      <div className="rounded-none md:rounded-[10px] border-0 md:border md:border-[1.5px] md:border-[var(--border)] bg-transparent md:bg-[var(--surface)]" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 25 }}>
            <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
          </div>
        ) : error ? (
          <div style={{ padding: '18px 11px', textAlign: 'center', color: 'var(--red)', fontWeight: 700 }}>{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '25px 11px', textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <Bot size={16} className="md:hidden" />
              <Bot size={16} className="hidden md:block" />
            </div>
            <div className="text-[12px] md:text-[12px]">{t('ai.empty_filtered')}</div>
          </div>
        ) : (
          <>
          <div className="md:hidden flex flex-col" style={{ gap: 10 }}>
            {filtered.map(s => {
              const al = ALERT_STYLE[s.alertLevel] ?? ALERT_STYLE.good
              const barColor = s.alertLevel === 'critical' ? 'var(--red)' : s.alertLevel === 'warning' ? 'var(--orange)' : s.alertLevel === 'recommendation' ? 'var(--amber)' : s.alertLevel === 'good' ? 'var(--blue)' : 'var(--green)'
              return (
                <div key={s.studentId} className="rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)]" style={{ background: 'var(--surface)', padding: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: 13 }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{s.className}</div>
                    </div>
                    <span style={{ padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: al.bg, color: al.color, display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      <al.icon size={12} /> {alertLabel(s.alertLevel)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${s.healthScore}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.5s' }} />
                    </div>
                    <span style={{ fontWeight: 700, color: barColor, fontSize: 13, flexShrink: 0 }}>{s.healthScore}</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="hidden md:block" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead>
                <tr>{[0, 1, 2, 3].map(i => (
                  <th key={i} style={thSt}>{t(`ai.table_headers.${i}`)}</th>
                ))}</tr>
              </thead>
              <tbody>
                {filtered.map(s => {
                  const al = ALERT_STYLE[s.alertLevel] ?? ALERT_STYLE.good
                  const barColor = s.alertLevel === 'critical' ? 'var(--red)' : s.alertLevel === 'warning' ? 'var(--orange)' : s.alertLevel === 'recommendation' ? 'var(--amber)' : s.alertLevel === 'good' ? 'var(--blue)' : 'var(--green)'
                  return (
                    <tr key={s.studentId}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                      <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{s.name}</td>
                      <td style={tdSt}>{s.className}</td>
                      <td style={tdSt}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 28, height: 8, background: 'var(--bg2)', borderRadius: 4, overflow: 'hidden' }}>
                            <div style={{ width: `${s.healthScore}%`, height: '100%', background: barColor, borderRadius: 4, transition: 'width 0.5s' }} />
                          </div>
                          <span style={{ fontWeight: 900, color: barColor, fontSize: 13 }}>{s.healthScore}</span>
                        </div>
                      </td>
                      <td style={tdSt}>
                        <span style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: al.bg, color: al.color, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                          <al.icon size={13} /> {alertLabel(s.alertLevel)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { color: 'var(--text3)', marginTop: 3 }
const btnSec: React.CSSProperties = { padding: '8px 12px', borderRadius: 8, fontSize: 13, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
const filterSt: React.CSSProperties = { background: 'var(--surface)', border: '1.5px solid var(--border2)', borderRadius: 8, fontWeight: 700, color: 'var(--text2)', outline: 'none', fontFamily: 'inherit' }
const thSt: React.CSSProperties = { padding: '11px 12px', textAlign: 'left', fontSize: 12, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.7px', whiteSpace: 'nowrap' }
const tdSt: React.CSSProperties = { padding: '11px 12px', fontSize: 13, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
