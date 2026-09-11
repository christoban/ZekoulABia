'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import { TrendingUp, BarChart3, PieChart as PieChartIcon, Apple, Package } from 'lucide-react'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
}

interface ClassItem { id: string; name: string; level?: string | null }
interface SubjectItem { id: string; name: string }
interface TeacherItem { id: string; firstName: string; lastName: string }

interface EvolutionPoint { sequenceName: string; periodName: string; moyenne: number; nbNotes: number }
interface ClassComparisonRow { classId: string; className: string; level: string | null; moyenne: number | null; nbEleves: number }
interface DistributionRow { label: string; count: number }
interface TeacherPerf {
  teacherName: string
  heuresPrevuesParSemaine: number
  seancesEnregistrees: number
  tauxPresence: number
  moyennesParClasse: { subjectName: string; className: string; moyenne: number | null; nbEleves: number }[]
}

const PIE_COLORS = ['var(--green)', 'var(--amber)', 'var(--blue)', 'var(--red)', 'var(--purple)', 'var(--text3)']

const CHART_TOOLTIP = {
  contentStyle: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)' },
  labelStyle: { color: 'var(--text2)' },
  itemStyle: { color: 'var(--text)' },
} as const

const cardCls = 'rounded-[10px] shadow-[0_1px_2px_rgba(20,20,15,0.05),0_1px_6px_rgba(20,20,15,0.06)] md:shadow-none border-0 md:border md:border-[1.5px] md:border-[var(--border)]'
const card: React.CSSProperties = { background: 'var(--surface)', overflow: 'hidden' }
const cardHeaderCls = 'px-3.5 pt-3 pb-2 md:px-4 md:py-3 md:border-b md:border-[var(--border)]'
const cardHeader: React.CSSProperties = {}
const cardTitle: React.CSSProperties = { fontWeight: 800, color: 'var(--text)', display: 'inline-flex', alignItems: 'center', gap: 8 }
const selectCls = 'text-[12.5px] md:text-[12px] px-[10px] py-[7px] md:px-[12px] md:py-[8px]'
const select: React.CSSProperties = { borderRadius: 8, border: '1.5px solid var(--border2)', fontFamily: 'inherit', color: 'var(--text)', background: 'var(--surface)' }

export default function SectionStatistics({ onToast }: Props) {
  const t = useT('admin')
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [subjects, setSubjects] = useState<SubjectItem[]>([])
  const [teachers, setTeachers] = useState<TeacherItem[]>([])

  const [evoClassId, setEvoClassId] = useState('')
  const [evoSubjectId, setEvoSubjectId] = useState('')

  const [level, setLevel] = useState('')

  const [criteria, setCriteria] = useState<'gender' | 'level' | 'paymentStatus'>('gender')

  const [teacherId, setTeacherId] = useState('')

  useEffect(() => {
    Promise.all([
      fetchApi('/api/v2/classes', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/subjects', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/users?role=TEACHER&limit=200', { credentials: 'include' }).then(r => r.json()),
    ]).then(([cd, sd, td]) => {
      setClasses(cd.data || [])
      setSubjects(sd.data || [])
      setTeachers(td.data || [])
    }).catch(() => {})
  }, [])

  const fetchEvolutionFn = useCallback(async (): Promise<EvolutionPoint[]> => {
    const params = new URLSearchParams()
    if (evoClassId) params.set('classId', evoClassId)
    if (evoSubjectId) params.set('subjectId', evoSubjectId)
    const res = await fetchApi(`/api/v2/statistics/grades-evolution?${params}`, { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || t('common.error'))
    return data.data || []
  }, [evoClassId, evoSubjectId])
  const { data: evolutionData, loading: evoLoading, error: evoError, fromCache: evoFromCache, cachedAt: evoCachedAt } = useCachedFetch<EvolutionPoint[]>(`admin:stats-evolution:${evoClassId}:${evoSubjectId}`, fetchEvolutionFn)
  const evolution = evolutionData ?? []

  const fetchComparisonFn = useCallback(async (): Promise<ClassComparisonRow[]> => {
    const params = new URLSearchParams()
    if (level) params.set('level', level)
    const res = await fetchApi(`/api/v2/statistics/classes-comparison?${params}`, { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || t('common.error'))
    return data.data || []
  }, [level])
  const { data: comparisonData, loading: compLoading, fromCache: compFromCache, cachedAt: compCachedAt } = useCachedFetch<ClassComparisonRow[]>(`admin:stats-comparison:${level}`, fetchComparisonFn)
  const comparison = comparisonData ?? []

  const fetchDistributionFn = useCallback(async (): Promise<DistributionRow[]> => {
    const res = await fetchApi(`/api/v2/statistics/students-distribution?criteria=${criteria}`, { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || t('common.error'))
    return data.data || []
  }, [criteria])
  const { data: distributionData, loading: distLoading, fromCache: distFromCache, cachedAt: distCachedAt } = useCachedFetch<DistributionRow[]>(`admin:stats-distribution:${criteria}`, fetchDistributionFn)
  const distribution = distributionData ?? []

  const fetchTeacherPerfFn = useCallback(async (): Promise<TeacherPerf | null> => {
    if (!teacherId) return null
    const res = await fetchApi(`/api/v2/statistics/teacher-performance/${teacherId}`, { credentials: 'include' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.message || t('common.error'))
    return data.data
  }, [teacherId])
  const { data: teacherPerf, loading: teacherLoading, fromCache: teacherFromCache, cachedAt: teacherCachedAt } = useCachedFetch<TeacherPerf | null>(`admin:stats-teacher:${teacherId}`, fetchTeacherPerfFn)

  useEffect(() => {
    if (evoError && evoError !== 'OFFLINE_NO_CACHE') onToast(evoError, 'error')
  }, [evoError, onToast])

  const levels = Array.from(new Set(classes.map(c => c.level).filter(Boolean))) as string[]

  return (
    <div className="px-4 py-5 md:px-6 md:py-5" style={{ height: '100%', overflowY: 'auto' }}>
      <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ marginBottom: 14 }}>
        <div className="text-[18px] md:text-[18px]" style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontWeight: 700, color: 'var(--text)' }}>
          {t('statistics.title')}
        </div>
        <div className="text-[12px] md:text-[13px]" style={{ color: 'var(--text3)', marginTop: 3 }}>{t('statistics.subtitle')}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12 }}>

        <div className={cardCls} style={card}>
          <div className={cardHeaderCls} style={{ ...cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span className="text-[12px] md:text-[13px]" style={cardTitle}><TrendingUp size={15} strokeWidth={2} /> {t('statistics.evolution_title')} <CacheBadge fromCache={evoFromCache} cachedAt={evoCachedAt} t={t} /></span>
            <div className="flex-wrap" style={{ display: 'flex', gap: 8 }}>
              <select className={`min-w-0 ${selectCls}`} style={select} value={evoClassId} onChange={e => setEvoClassId(e.target.value)}>
                <option value="">{t('statistics.all_classes')}</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select className={`min-w-0 ${selectCls}`} style={select} value={evoSubjectId} onChange={e => setEvoSubjectId(e.target.value)}>
                <option value="">{t('statistics.all_subjects')}</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="p-3.5 md:px-4 md:py-3.5 h-[240px] md:h-[280px]">
            {evoLoading ? (
              <Spinner />
            ) : evolution.length === 0 ? (
              <EmptyState text={t('statistics.evolution_empty')} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={evolution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="sequenceName" tick={{ fontSize: 11, fill: 'var(--text3)' }} stroke="var(--border)" />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 11, fill: 'var(--text3)' }} stroke="var(--border)" />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Line type="monotone" dataKey="moyenne" name={t('statistics.series_average')} stroke="var(--green)" strokeWidth={2.5} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={cardCls} style={card}>
          <div className={cardHeaderCls} style={{ ...cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span className="text-[12px] md:text-[13px]" style={cardTitle}><BarChart3 size={15} strokeWidth={2} /> {t('statistics.comparison_title')} <CacheBadge fromCache={compFromCache} cachedAt={compCachedAt} t={t} /></span>
            <select className={selectCls} style={select} value={level} onChange={e => setLevel(e.target.value)}>
              <option value="">{t('statistics.all_levels')}</option>
              {levels.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <div className="p-3.5 md:px-4 md:py-3.5 h-[240px] md:h-[280px]">
            {compLoading ? (
              <Spinner />
            ) : comparison.length === 0 ? (
              <EmptyState text={t('statistics.comparison_empty')} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparison}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="className" tick={{ fontSize: 11, fill: 'var(--text3)' }} stroke="var(--border)" />
                  <YAxis domain={[0, 20]} tick={{ fontSize: 11, fill: 'var(--text3)' }} stroke="var(--border)" />
                  <Tooltip {...CHART_TOOLTIP} />
                  <Bar dataKey="moyenne" name={t('statistics.series_general_average')} fill="var(--blue)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={cardCls} style={card}>
          <div className={cardHeaderCls} style={{ ...cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span className="text-[12px] md:text-[13px]" style={cardTitle}><PieChartIcon size={15} strokeWidth={2} /> {t('statistics.distribution_title')} <CacheBadge fromCache={distFromCache} cachedAt={distCachedAt} t={t} /></span>
            <select className={selectCls} style={select} value={criteria} onChange={e => setCriteria(e.target.value as typeof criteria)}>
              <option value="gender">{t('statistics.criteria_gender')}</option>
              <option value="level">{t('statistics.criteria_level')}</option>
              <option value="paymentStatus">{t('statistics.criteria_payment')}</option>
            </select>
          </div>
          <div className="p-3.5 md:px-4 md:py-3.5 h-[240px] md:h-[280px]">
            {distLoading ? (
              <Spinner />
            ) : distribution.length === 0 ? (
              <EmptyState text={t('statistics.no_data_available')} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={distribution} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>
                    {distribution.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip {...CHART_TOOLTIP} />
                  <Legend wrapperStyle={{ fontSize: 11, color: 'var(--text2)' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className={cardCls} style={card}>
          <div className={cardHeaderCls} style={{ ...cardHeader, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
            <span className="text-[12px] md:text-[13px]" style={cardTitle}><Apple size={15} strokeWidth={2} /> {t('statistics.teacher_title')} <CacheBadge fromCache={teacherFromCache} cachedAt={teacherCachedAt} t={t} /></span>
            <select className={selectCls} style={select} value={teacherId} onChange={e => setTeacherId(e.target.value)}>
              <option value="">{t('statistics.teacher_select_placeholder')}</option>
              {teachers.map(tc => <option key={tc.id} value={tc.id}>{tc.firstName} {tc.lastName}</option>)}
            </select>
          </div>
          <div className="p-3.5 md:px-4 md:py-3.5" style={{ minHeight: 280 }}>
            {!teacherId ? (
              <EmptyState text={t('statistics.teacher_empty_no_selection')} />
            ) : teacherLoading ? (
              <Spinner />
            ) : !teacherPerf ? (
              <EmptyState text={t('statistics.no_data_available')} />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3" style={{ gap: 8, marginBottom: 13 }}>
                  <Kpi label={t('statistics.kpi_hours_planned')} value={String(teacherPerf.heuresPrevuesParSemaine)} />
                  <Kpi label={t('statistics.kpi_sessions_recorded')} value={String(teacherPerf.seancesEnregistrees)} />
                  <Kpi label={t('statistics.kpi_attendance_rate')} value={`${teacherPerf.tauxPresence}%`} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 160, overflowY: 'auto' }}>
                  {teacherPerf.moyennesParClasse.map((m, i) => (
                    <div key={i} className="text-[12px] md:text-[12px]" style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                      <span style={{ color: 'var(--text2)', fontWeight: 600 }}>{m.subjectName} · {m.className}</span>
                      <span style={{ fontWeight: 800, color: 'var(--text)' }}>{m.moyenne !== null ? `${m.moyenne}/20` : '—'}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div style={{ width: 28, height: 28, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-[12.5px] md:text-[12px]" style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text3)', textAlign: 'center', padding: '14px' }}>
      {text}
    </div>
  )
}

function CacheBadge({ fromCache, cachedAt, t }: { fromCache: boolean; cachedAt: number | null; t: (key: string, params?: Record<string, string | number>) => string }) {
  if (!fromCache || !cachedAt) return null
  return (
    <span className="text-[11px] md:text-[12px]" style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 8, padding: '3px 9px', fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <Package size={12} strokeWidth={2} /> {t('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
    </span>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 md:p-3" style={{ background: 'var(--bg)', borderRadius: 8, textAlign: 'center' }}>
      <div className="text-[18px] md:text-[18px]" style={{ fontWeight: 900, color: 'var(--text)' }}>{value}</div>
      <div className="text-[11px] md:text-[12px]" style={{ color: 'var(--text3)', fontWeight: 600, marginTop: 2 }}>{label}</div>
    </div>
  )
}
