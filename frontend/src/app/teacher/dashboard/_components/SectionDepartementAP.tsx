'use client'
import { useState, useCallback, useMemo } from 'react'
import { BarChart3, Clock, TrendingUp, Target, BookOpen, Package } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import DeptPerformancesTab from './departementAP/DeptPerformancesTab'
import DeptHorairesTab from './departementAP/DeptHorairesTab'
import DeptProgressionTab from './departementAP/DeptProgressionTab'
import DeptProgrammesTab from './departementAP/DeptProgrammesTab'
import type {
  SectionDepartementAPProps,
  PerfRow,
  HoraireRow,
  DeptTab,
  ProgAlerte,
} from './departementAP/types'

export type { SectionDepartementAPProps }

interface TimetableSlotRaw {
  durationMinutes?: number | null
  teacher?: { id?: string; user?: { firstName?: string | null; lastName?: string | null } | null } | null
  subject?: { id?: string; name?: string | null } | null
}

interface TimetableRaw {
  slots?: TimetableSlotRaw[]
}

export default function SectionDepartementAP({
  user,
  departementId,
  departementNom,
  departmentsList,
  onSelectDept,
  onToast,
}: SectionDepartementAPProps) {
  const t = useT('teacher')
  const tcommon = useT('common')
  const [tab, setTab] = useState<DeptTab>('performances')

  const showToast = useCallback((msg: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    if (onToast) onToast(msg, type)
  }, [onToast])

  // ─── Onglet Performances ──────────────────────────────────────────────────
  const fetchPerfFn = useCallback(async (): Promise<PerfRow[]> => {
    const res = await fetchApi(`/api/v2/departments/${departementId}/performance`, { credentials: 'include' })
    const d = await res.json()
    return Array.isArray(d.data) ? d.data : []
  }, [departementId])
  const { data: perfData, loading: perfLoading, error: perfError, fromCache: perfFromCache, cachedAt: perfCachedAt } =
    useCachedFetch<PerfRow[]>(tab === 'performances' ? `teacher:dept-perf:${departementId}` : '', fetchPerfFn)
  const perf = perfData ?? []

  // ─── Onglet Horaires ──────────────────────────────────────────────────────
  const fetchHorairesFn = useCallback(async (): Promise<HoraireRow[]> => {
    const res = await fetchApi(`/api/v2/timetables?departmentId=${departementId}`, { credentials: 'include' })
    const d = await res.json()
    if (!d.success) return []
    const map = new Map<string, { teacherName: string; subjectName: string; totalHours: number }>()
    for (const timetable of (d.data ?? []) as TimetableRaw[]) {
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

  // ─── Matières du département & Onglet Progression ─────────────────────────
  const currentDept = useMemo(
    () => departmentsList?.find(dept => dept.id === departementId) || user?.headedDepartments?.find(dept => dept.id === departementId),
    [departmentsList, user?.headedDepartments, departementId]
  )
  const deptSubjects = useMemo(() => currentDept?.subjects ?? [], [currentDept])
  const allowedSubjectNames = useMemo(
    () => new Set(deptSubjects.map(s => s.name.toLowerCase().trim())),
    [deptSubjects]
  )
  const allowedSubjectIds = useMemo(
    () => new Set(deptSubjects.map(s => s.id)),
    [deptSubjects]
  )

  const fetchAlertesFn = useCallback(async (): Promise<ProgAlerte[]> => {
    const res = await fetchApi('/api/v2/pedagogie/alertes-retard', { credentials: 'include' })
    const d = await res.json()
    if (!d.success) throw new Error(t('department.error_progression'))
    const allAlertes: ProgAlerte[] = d.data ?? []

    if (allowedSubjectNames.size > 0) {
      return allAlertes.filter(a => allowedSubjectNames.has((a.subjectName || '').toLowerCase().trim()))
    }
    return allAlertes
  }, [t, allowedSubjectNames])
  const { data: alertesData, loading: alertesLoading, fromCache: alFromCache, cachedAt: alCachedAt } =
    useCachedFetch<ProgAlerte[]>(tab === 'progression' ? `teacher:dept-progression:${departementId}` : '', fetchAlertesFn)
  const alertes = alertesData ?? []

  const error = tab === 'performances' && perfError && perfError !== 'OFFLINE_NO_CACHE' ? t('department.error_performance') : null
  const fromCache = tab === 'performances' ? perfFromCache : tab === 'horaires' ? horFromCache : tab === 'progression' ? alFromCache : false
  const cachedAt = tab === 'performances' ? perfCachedAt : tab === 'horaires' ? horCachedAt : tab === 'progression' ? alCachedAt : null

  const tabBtn = (tabId: DeptTab, label: string, Icon: typeof BarChart3) => (
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
          {t('department.subtitle')} · Matières : {deptSubjects.map(s => s.name).join(', ') || 'Aucune matière assignée'}
        </div>
        {fromCache && cachedAt && (
          <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '4px 10px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8 }}>
            <Package size={13} strokeWidth={2} /> {tcommon('cacheBadge', { date: new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) })}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabBtn('performances', t('department.tab_performances') || 'Performances', BarChart3)}
        {tabBtn('horaires', t('department.tab_horaires') || 'Volume horaire', Clock)}
        {tabBtn('progression', t('department.tab_progression') || 'Progression', TrendingUp)}
        {tabBtn('programmes', 'Programmes & Chapitres', BookOpen)}
      </div>

      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--red-light)', borderRadius: 8, color: 'var(--red)', fontSize: 12.5, fontWeight: 600 }}>{error}</div>
      )}

      {tab === 'performances' && (
        <DeptPerformancesTab perf={perf} loading={perfLoading} t={t} tcommon={tcommon} />
      )}

      {tab === 'horaires' && (
        <DeptHorairesTab horaires={horaires} loading={horairesLoading} t={t} tcommon={tcommon} />
      )}

      {tab === 'progression' && (
        <DeptProgressionTab
          departementId={departementId}
          alertes={alertes}
          loading={alertesLoading}
          onShowToast={showToast}
          t={t}
        />
      )}

      {tab === 'programmes' && (
        <DeptProgrammesTab
          key={departementId}
          departementId={departementId}
          deptSubjects={deptSubjects}
          allowedSubjectIds={allowedSubjectIds}
          allowedSubjectNames={allowedSubjectNames}
          showToast={showToast}
          tcommon={tcommon}
        />
      )}
    </div>
  )
}
