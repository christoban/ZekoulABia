'use client'
import { useState, useCallback } from 'react'
import { Inbox, AlertTriangle, CheckCircle2, BarChart3, Clock, TrendingUp, Circle, Target, Package } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'

interface Props {
  user: UserInfo
  departementId: string
  departementNom: string
  departmentsList?: { id: string; name: string; color: string; subjects?: { id: string; name: string }[] }[]
  onSelectDept?: (id: string) => void
}

interface PerfRow {
  teacherName: string
  subjectName: string
  className: string
  moyenne: number | null
  nbEleves: number
}

interface HoraireRow {
  teacherName: string
  subjectName: string
  totalHours: number
  isOverLimit: boolean
}

type Tab = 'performances' | 'horaires' | 'progression'

interface ProgAlerte {
  programmeTitre: string; subjectName: string; className: string
  chapitresTotal: number; chapitresRealises: number; progressionPct: number
  attenduPct: number; retardPct: number; niveau: 'CRITIQUE' | 'MODERE'
}

export default function SectionDepartementAP({ user, departementId, departementNom, departmentsList, onSelectDept }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const [tab, setTab] = useState<Tab>('performances')

  const fetchPerfFn = useCallback(async (): Promise<PerfRow[]> => {
    const res = await fetchApi(`/api/v2/departments/${departementId}/performance`, { credentials: 'include' })
    const d = await res.json()
    return Array.isArray(d.data) ? d.data : []
  }, [departementId])
  const { data: perfData, loading: perfLoading, error: perfError, fromCache: perfFromCache, cachedAt: perfCachedAt } =
    useCachedFetch<PerfRow[]>(tab === 'performances' ? `teacher:dept-perf:${departementId}` : '', fetchPerfFn)
  const perf = perfData ?? []

  const fetchHorairesFn = useCallback(async (): Promise<HoraireRow[]> => {
    const res = await fetchApi(`/api/v2/timetables?departmentId=${departementId}`, { credentials: 'include' })
    const d = await res.json()
    if (!d.success) return []
    const map = new Map<string, { teacherName: string; subjectName: string; totalHours: number }>()
    for (const timetable of d.data ?? []) {
      for (const slot of timetable.slots ?? []) {
        const key = `${slot.teacher?.id}__${slot.subject?.id}`
        const dur = slot.durationMinutes ?? 60
        const existing = map.get(key)
        if (existing) {
          existing.totalHours += dur / 60
        } else {
          map.set(key, {
            teacherName: slot.teacher ? `${slot.teacher.user?.firstName ?? ''} ${slot.teacher.user?.lastName ?? ''}`.trim() : '—',
            subjectName: slot.subject?.name ?? '—',
            totalHours: dur / 60,
          })
        }
      }
    }
    return [...map.values()].map(r => ({ ...r, isOverLimit: r.totalHours > 14 })).sort((a, b) => b.totalHours - a.totalHours)
  }, [departementId])
  const { data: horairesData, loading: horairesLoading, fromCache: horFromCache, cachedAt: horCachedAt } =
    useCachedFetch<HoraireRow[]>(tab === 'horaires' ? `teacher:dept-hours:${departementId}` : '', fetchHorairesFn)
  const horaires = horairesData ?? []

  const fetchAlertesFn = useCallback(async (): Promise<ProgAlerte[]> => {
    const res = await fetchApi(`/api/v2/pedagogie/alertes-retard`, { credentials: 'include' })
    const d = await res.json()
    if (!d.success) throw new Error(t('department.error_progression'))
    const allAlertes: ProgAlerte[] = d.data ?? []

    // Scope strict du département : ne garder que les alertes pour les matières gérées par ce département
    const currentDept = departmentsList?.find(dept => dept.id === departementId) || user?.headedDepartments?.find(dept => dept.id === departementId)
    const allowedSubjectNames = new Set((currentDept?.subjects ?? []).map(s => s.name.toLowerCase().trim()))
    if (allowedSubjectNames.size > 0) {
      return allAlertes.filter(a => allowedSubjectNames.has((a.subjectName || '').toLowerCase().trim()))
    }
    return allAlertes
  }, [t, departementId, departmentsList, user?.headedDepartments])
  const { data: alertesData, loading: alertesLoading, fromCache: alFromCache, cachedAt: alCachedAt } =
    useCachedFetch<ProgAlerte[]>(tab === 'progression' ? `teacher:dept-progression:${departementId}` : '', fetchAlertesFn)
  const alertes = alertesData ?? []

  const loading = tab === 'performances' ? perfLoading : tab === 'horaires' ? horairesLoading : alertesLoading
  const error = tab === 'performances' && perfError && perfError !== 'OFFLINE_NO_CACHE' ? t('department.error_performance') : null
  const fromCache = tab === 'performances' ? perfFromCache : tab === 'horaires' ? horFromCache : alFromCache
  const cachedAt = tab === 'performances' ? perfCachedAt : tab === 'horaires' ? horCachedAt : alCachedAt

  const tabBtn = (tabId: Tab, label: string, Icon: typeof BarChart3) => (
    <button onClick={() => setTab(tabId)}
      style={{ minHeight: 38, padding: '7px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', border: 'none',
        background: tab === tabId ? 'var(--sidebar)' : 'var(--bg2)', color: tab === tabId ? 'white' : 'var(--text2)', transition: 'all 0.15s',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexShrink: 0 }}>
      <Icon size={14} strokeWidth={2} />{label}
    </button>
  )

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3.5 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      {/* Sélecteur multi-départements AP si l'animateur en dirige plusieurs */}
      {departmentsList && departmentsList.length > 1 && (
        <div className="flex items-center gap-2 p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] overflow-x-auto">
          <span className="text-xs font-bold text-[var(--text3)] px-2 whitespace-nowrap">Mes départements :</span>
          {departmentsList.map(d => (
            <button
              key={d.id}
              onClick={() => onSelectDept?.(d.id)}
              className={`px-3 py-1.5 rounded-md text-xs font-extrabold cursor-pointer border transition-all ${
                d.id === departementId
                  ? 'text-white border-transparent'
                  : 'bg-[var(--bg)] text-[var(--text2)] border-[var(--border)] hover:text-[var(--text)]'
              }`}
              style={d.id === departementId ? { background: d.color || 'var(--sidebar)' } : {}}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {/* Header */}
      <div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={18} strokeWidth={2} />{t('department.title').replace('{name}', departementNom)}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginTop: 2 }}>
          {t('department.subtitle')}
        </div>
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
            <Package size={13} strokeWidth={2} /> {tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabBtn('performances', t('department.tab_performances'), BarChart3)}
        {tabBtn('horaires', t('department.tab_horaires'), Clock)}
        {tabBtn('progression', t('department.tab_progression'), TrendingUp)}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--red-light)', borderRadius: 8, color: 'var(--red)', fontSize: 12.5, fontWeight: 600 }}>{error}</div>
      )}

      {/* Onglet Performances */}
      {tab === 'performances' && (
        <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('department.performance_title')}</span>
            <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{t('department.performance_count').replace('{count}', String(perf.length))}</span>
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{tcommon('status.loading')}</div>
          ) : perf.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Inbox size={26} strokeWidth={2} /></div>
              <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{t('department.performance_empty')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--border2)', marginTop: 4 }}>{t('department.performance_empty_hint')}</div>
            </div>
          ) : (
            <>
              {/* Vue mobile par cartes */}
              <div className="md:hidden divide-y divide-[var(--border)]">
                {perf.map((row, i) => {
                  const moy = row.moyenne
                  const moyBg = moy === null ? 'var(--bg2)' : moy >= 12 ? 'var(--green-light)' : moy >= 8 ? 'var(--amber-light)' : 'var(--red-light)'
                  const moyColor = moy === null ? 'var(--text3)' : moy >= 12 ? 'var(--green)' : moy >= 8 ? 'var(--amber)' : 'var(--red)'
                  return (
                    <div key={i} className="p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-[var(--text)]">{row.teacherName}</span>
                        <span style={{ background: moyBg, color: moyColor, padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 800 }}>
                          {moy !== null ? `${moy.toFixed(2)}/20` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-[var(--text2)]">
                        <span>{row.subjectName} · <strong>{row.className}</strong></span>
                        <span className="text-[var(--text3)]">{row.nbEleves} élèves</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Table desktop */}
              <div className="hidden md:block overflow-x-auto">
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
                  <thead>
                    <tr style={{ background: 'var(--bg2)' }}>
                      {[t('department.perf_table_teacher'), t('department.perf_table_subject'), t('department.perf_table_class'), t('department.perf_table_average'), t('department.perf_table_students')].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {perf.map((row, i) => {
                      const moy = row.moyenne
                      const moyBg = moy === null ? 'var(--bg2)' : moy >= 12 ? 'var(--green-light)' : moy >= 8 ? 'var(--amber-light)' : 'var(--red-light)'
                      const moyColor = moy === null ? 'var(--text3)' : moy >= 12 ? 'var(--green)' : moy >= 8 ? 'var(--amber)' : 'var(--red)'
                      return (
                        <tr key={i} style={{ borderTop: '1px solid var(--bg)', background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                          <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{row.teacherName}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{row.subjectName}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{row.className}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ background: moyBg, color: moyColor, padding: '2px 8px', borderRadius: 12, fontSize: 11.5, fontWeight: 800 }}>
                              {moy !== null ? moy.toFixed(2) : '—'}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{row.nbEleves}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* Onglet Volume horaire */}
      {tab === 'horaires' && (
        <div className="space-y-3">
          {/* Alerte limite légale */}
          <div style={{ padding: '8px 12px', background: 'var(--amber-light)', border: '1px solid var(--amber-light)', borderRadius: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ display: 'flex', flexShrink: 0 }}><AlertTriangle size={15} strokeWidth={2} /></span>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>{t('department.hours_legal_warn')} — <span style={{ fontWeight: 500 }}>{t('department.hours_legal_hint')}</span></div>
            </div>
          </div>

          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{t('department.hours_title')}</span>
            </div>
            {loading ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{tcommon('status.loading')}</div>
            ) : horaires.length === 0 ? (
              <div style={{ padding: 36, textAlign: 'center' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Inbox size={26} strokeWidth={2} /></div>
                <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{t('department.hours_empty')}</div>
              </div>
            ) : (
              <>
                {/* Vue mobile par cartes */}
                <div className="md:hidden divide-y divide-[var(--border)]">
                  {horaires.map((row, i) => (
                    <div key={i} className="p-3.5 space-y-2" style={{ background: row.isOverLimit ? 'var(--red-light)' : undefined }}>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-sm font-bold" style={{ color: row.isOverLimit ? 'var(--red)' : 'var(--text)' }}>{row.teacherName}</div>
                          <div className="text-xs text-[var(--text2)]">{row.subjectName}</div>
                        </div>
                        {row.isOverLimit
                          ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--red-light)', color: 'var(--red)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}><Circle size={6} fill="var(--red)" stroke="none" />{t('department.hours_over')}</span>
                          : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--green-light)', color: 'var(--green)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}><CheckCircle2 size={11} strokeWidth={2} />{t('department.hours_ok')}</span>
                        }
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black" style={{ color: row.isOverLimit ? 'var(--red)' : 'var(--text)' }}>{row.totalHours.toFixed(1)}h</span>
                        <div className="flex-1 bg-[var(--bg2)] rounded-full h-1.5 overflow-hidden">
                          <div style={{ height: '100%', width: `${Math.min((row.totalHours / 20) * 100, 100)}%`, background: row.isOverLimit ? 'var(--red)' : 'var(--green)' }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Table desktop */}
                <div className="hidden md:block overflow-x-auto">
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg2)' }}>
                        {[t('department.hours_table_teacher'), t('department.hours_table_subject'), t('department.hours_table_hours'), t('department.hours_table_status')].map(h => (
                          <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {horaires.map((row, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--bg)', background: row.isOverLimit ? 'var(--red-light)' : i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                          <td style={{ padding: '8px 12px', fontSize: 12.5, fontWeight: 700, color: row.isOverLimit ? 'var(--red)' : 'var(--text)' }}>{row.teacherName}</td>
                          <td style={{ padding: '8px 12px', fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>{row.subjectName}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 800, color: row.isOverLimit ? 'var(--red)' : 'var(--text)' }}>
                                {row.totalHours.toFixed(1)}h
                              </span>
                              <div style={{ flex: 1, background: 'var(--bg2)', borderRadius: 3, height: 4, maxWidth: 80, overflow: 'hidden' }}>
                                <div style={{ height: '100%', borderRadius: 3, width: `${Math.min((row.totalHours / 20) * 100, 100)}%`, background: row.isOverLimit ? 'var(--red)' : 'var(--green)' }} />
                              </div>
                            </div>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {row.isOverLimit
                              ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--red-light)', color: 'var(--red)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}><Circle size={6} fill="var(--red)" stroke="none" />{t('department.hours_over')}</span>
                              : <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--green-light)', color: 'var(--green)', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 800 }}><CheckCircle2 size={11} strokeWidth={2} />{t('department.hours_ok')}</span>
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Onglet Progression programmes */}
      {tab === 'progression' && (
        <div>
          <div style={{ padding: '8px 12px', background: 'var(--green-light)', border: '1px solid var(--green-light)', borderRadius: 8, marginBottom: 12, fontSize: 12, fontWeight: 600, color: 'var(--green)' }}>
            {t('department.progression_info')}
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)', fontSize: 12.5 }}>{t('department.progression_loading')}</div>
          ) : alertes.length === 0 ? (
            <div style={{ padding: 36, textAlign: 'center', background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><CheckCircle2 size={26} strokeWidth={2} color="var(--green)" /></div>
              <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700 }}>{t('department.progression_no_alerts')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 2 }}>{t('department.progression_no_alerts_hint')}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alertes.map((a, i) => {
                const isCritique = a.niveau === 'CRITIQUE'
                return (
                  <div key={i} style={{ background: 'var(--surface)', borderRadius: 10, border: `1px solid ${isCritique ? 'var(--red-light)' : 'var(--amber-light)'}`, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <div style={{ background: isCritique ? 'var(--red-light)' : 'var(--amber-light)', borderRadius: 7, padding: '6px 10px', textAlign: 'center', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: isCritique ? 'var(--red)' : 'var(--amber)' }}>-{a.retardPct}%</div>
                        <div style={{ fontSize: 9.5, fontWeight: 800, color: isCritique ? 'var(--red)' : 'var(--amber)', textTransform: 'uppercase' }}>{a.niveau}</div>
                      </div>
                      <div>
                        <div style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                          <span style={{ background: 'var(--blue-light)', color: 'var(--blue)', padding: '1px 6px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{a.className}</span>
                          <span style={{ background: 'var(--amber-light)', color: 'var(--amber)', padding: '1px 6px', borderRadius: 12, fontSize: 11, fontWeight: 700 }}>{a.subjectName}</span>
                        </div>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{a.programmeTitre}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text2)', marginTop: 2 }}>
                          {t('department.progression_chapters').replace('{done}', String(a.chapitresRealises)).replace('{total}', String(a.chapitresTotal)).replace('{pct}', String(a.progressionPct)).replace('{expected}', String(a.attenduPct))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
