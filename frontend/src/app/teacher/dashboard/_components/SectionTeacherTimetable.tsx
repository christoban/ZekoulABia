'use client'
import { useState, useEffect, useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import TimetableHeaderBar from './timetable/TimetableHeaderBar'
import TimetableCatchupModal from './timetable/TimetableCatchupModal'
import TimetableMobileView from './timetable/TimetableMobileView'
import TimetableDesktopView from './timetable/TimetableDesktopView'
import {
  DAY_MAP,
  DEFAULT_SKELETON,
  EMPTY_CATCHUP,
  type PeriodeGrille,
  type CellSlots,
  type TeacherTtRow,
  type TeacherGridConfig,
} from './timetable/types'

export type { PeriodeGrille }

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

export default function SectionTeacherTimetable({ onToast, user }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')

  const [timetablesData, setTimetablesData] = useState<TeacherTtRow[]>([])
  const [squelette, setSquelette] = useState<PeriodeGrille[]>(DEFAULT_SKELETON)
  const [joursActifs, setJoursActifs] = useState<string[]>(['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'])
  const [squeletteParJour, setSqueletteParJour] = useState<Record<string, PeriodeGrille[]>>({})

  const [selectedView, setSelectedView] = useState<string>('MY_SCHEDULE')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fromCache, setFromCache] = useState(false)
  const [cachedAt, setCachedAt] = useState<number | null>(null)
  const [catchup, setCatchup] = useState(EMPTY_CATCHUP)
  const [catchupClasses, setCatchupClasses] = useState<{ id: string; name: string }[]>([])

  const userId = user?.id

  const applyGridConfig = (grid: TeacherGridConfig | undefined) => {
    if (!grid) return
    if (Array.isArray(grid.squelette) && grid.squelette.length > 0) setSquelette(grid.squelette)
    if (Array.isArray(grid.config?.joursActifs) && grid.config.joursActifs.length > 0) setJoursActifs(grid.config.joursActifs)
    if (grid.squeletteParJour && typeof grid.squeletteParJour === 'object') setSqueletteParJour(grid.squeletteParJour)
  }

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    const cacheKeyTt = `teacher:timetables:${userId || 'all'}`
    const cacheKeyGrid = 'teacher:timetable-grid-config'

    if (!navigator.onLine) {
      try {
        const [cachedTt, cachedGrid] = await Promise.all([
          getCachedData<TeacherTtRow[]>(cacheKeyTt),
          getCachedData<TeacherGridConfig>(cacheKeyGrid),
        ])
        if (cachedTt?.data) {
          setTimetablesData(cachedTt.data)
          setFromCache(true)
          setCachedAt(cachedTt.cachedAt)
          applyGridConfig(cachedGrid?.data)
          setLoading(false)
          return
        }
      } catch { /* ignore */ }
    }

    try {
      const [res, gridRes] = await Promise.all([
        fetchApi('/api/v2/timetables', { credentials: 'include' }).then(r => r.json()),
        fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()).catch(() => ({ success: false })),
      ])

      if (res.success) {
        setTimetablesData(res.data || [])
        setFromCache(false)
        await putCachedData(cacheKeyTt, res.data || [])

        if (gridRes?.success && gridRes.data) {
          await putCachedData(cacheKeyGrid, gridRes.data)
          applyGridConfig(gridRes.data)
        }
      } else {
        throw new Error(t('timetable.error_loading'))
      }
    } catch (err: unknown) {
      try {
        const cachedTt = await getCachedData<TeacherTtRow[]>(cacheKeyTt)
        const cachedGrid = await getCachedData<TeacherGridConfig>(cacheKeyGrid)
        if (cachedTt?.data) {
          setTimetablesData(cachedTt.data)
          setFromCache(true)
          setCachedAt(cachedTt.cachedAt)
          applyGridConfig(cachedGrid?.data)
          setLoading(false)
          return
        }
      } catch { /* ignore */ }
      setError(err instanceof Error ? err.message : t('timetable.error_network'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ne lister QUE les classes où cet enseignant donne AU MOINS UN cours
  const myClasses = useMemo(() => {
    const classesMap = new Map<string, string>()
    timetablesData.forEach((tt) => {
      const hasMyCourse = (tt.slots || []).some((s) => userId && s.teacher?.id === userId)
      if (hasMyCourse && tt.class?.id) {
        classesMap.set(tt.class.id, tt.class.name || 'Classe')
      }
    })
    return Array.from(classesMap.entries()).map(([id, name]) => ({ id, name }))
  }, [timetablesData, userId])

  const currentViewTitle = useMemo(() => {
    if (selectedView === 'MY_SCHEDULE') return t('timetable.view_my_schedule')
    const found = myClasses.find(c => c.id === selectedView)
    return found ? `${t('timetable.view_by_class')} : ${found.name}` : t('timetable.view_my_schedule')
  }, [selectedView, myClasses, t])

  const slots = useMemo(() => {
    const slotMap: Record<string, CellSlots> = {}

    if (selectedView === 'MY_SCHEDULE') {
      timetablesData.forEach((tt) => {
        (tt.slots || []).forEach((s) => {
          if (!userId || s.teacher?.id !== userId) return
          const key = `${s.dayOfWeek}-${s.startTime}`
          const values = slotMap[key] ?? []
          values.push({
            subject: s.subject?.name || '',
            classe: tt.class?.name || '',
            room: s.room || '',
            kind: s.kind || 'CLASS',
            isMine: true,
            groupId: s.groupId,
          })
          slotMap[key] = values
        })
      })
    } else {
      const selectedTt = timetablesData.find((tt) => tt.class?.id === selectedView)
      if (selectedTt) {
        (selectedTt.slots || []).forEach((s) => {
          const isMine = Boolean(userId && s.teacher?.id === userId)
          const key = `${s.dayOfWeek}-${s.startTime}`
          const values = slotMap[key] ?? []
          values.push({
            subject: s.subject?.name || '',
            classe: selectedTt.class?.name || '',
            teacher: s.teacher ? `${s.teacher.firstName} ${s.teacher.lastName}` : '',
            room: s.room || '',
            kind: s.kind || 'CLASS',
            isMine,
            groupId: s.groupId,
          })
          slotMap[key] = values
        })
      }
    }

    return slotMap
  }, [timetablesData, selectedView, userId])

  const openCatchupModal = async () => {
    setCatchup({ ...EMPTY_CATCHUP, open: true })
    try {
      const res = await fetchApi('/api/v2/classes', { credentials: 'include' })
      const data = await res.json()
      setCatchupClasses(data.data || [])
    } catch { /* ignore */ }
  }

  const submitCatchup = async () => {
    if (!catchup.classId || !catchup.proposedDate) {
      setCatchup(f => ({ ...f, error: t('timetable.catchup_error_required') }))
      return
    }
    setCatchup(f => ({ ...f, loading: true, error: '' }))
    try {
      const body: Record<string, string> = { classId: catchup.classId, proposedDate: catchup.proposedDate }
      if (catchup.subjectId) body.subjectId = catchup.subjectId
      if (catchup.proposedStartTime) body.proposedStartTime = catchup.proposedStartTime
      if (catchup.proposedEndTime) body.proposedEndTime = catchup.proposedEndTime
      if (catchup.reason.trim()) body.reason = catchup.reason.trim()
      const res = await fetchApi('/api/v2/timetables/catchup-requests', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) {
        let errMsg = data.message || t('timetable.catchup_error_server')
        if (res.status === 409) errMsg = t('timetable.catchup_error_conflict')
        else if (res.status === 400) errMsg = t('timetable.catchup_error_required')
        setCatchup(f => ({ ...f, error: errMsg, loading: false }))
        return
      }
      onToast(t('timetable.catchup_success'), 'success')
      setCatchup(EMPTY_CATCHUP)
    } catch (err) {
      setCatchup(f => ({
        ...f,
        error: err instanceof Error ? err.message : t('timetable.catchup_error_server'),
        loading: false,
      }))
    }
  }

  const [selectedDay, setSelectedDay] = useState(() => {
    const todayIndex = new Date().getDay()
    const mappedDay = todayIndex === 0 ? 6 : todayIndex - 1
    const foundIdx = joursActifs.findIndex(j => DAY_MAP[j] === mappedDay)
    return foundIdx >= 0 ? foundIdx : 0
  })

  useEffect(() => {
    if (selectedDay >= joursActifs.length) {
      setSelectedDay(0)
    }
  }, [joursActifs, selectedDay])

  const getWeekRange = () => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1))
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return t('timetable.week_range').replace('{start}', fmt(monday)).replace('{end}', fmt(friday))
  }

  if (loading) {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ padding: '16px 20px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 16, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>
          <button
            onClick={fetchData}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 14px', borderRadius: 7, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <RefreshCw size={13} strokeWidth={2} />{t('timetable.retry')}
          </button>
        </div>
      </div>
    )
  }

  const activeDayName = joursActifs[selectedDay] || 'LUNDI'
  const squeletteDuJour = squeletteParJour[activeDayName] || squelette

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <TimetableHeaderBar
        weekRangeLabel={getWeekRange()}
        currentViewTitle={currentViewTitle}
        fromCache={fromCache}
        cachedAt={cachedAt}
        selectedView={selectedView}
        myClasses={myClasses}
        onSelectView={setSelectedView}
        onOpenCatchup={openCatchupModal}
        t={t}
        tcommon={tcommon}
      />

      <TimetableCatchupModal
        catchup={catchup}
        catchupClasses={catchupClasses}
        teacherSubjects={user?.teacherProfile?.teacherSubjects || []}
        onChange={setCatchup}
        onClose={() => setCatchup(EMPTY_CATCHUP)}
        onSubmit={submitCatchup}
        t={t}
      />

      <TimetableMobileView
        joursActifs={joursActifs}
        selectedDay={selectedDay}
        activeDayName={activeDayName}
        squeletteDuJour={squeletteDuJour}
        slots={slots}
        selectedView={selectedView}
        onSelectDay={setSelectedDay}
        onSlotToast={(msg) => onToast(msg, 'info')}
        t={t}
      />

      <TimetableDesktopView
        joursActifs={joursActifs}
        squelette={squelette}
        slots={slots}
        selectedView={selectedView}
        onSlotToast={(msg) => onToast(msg, 'info')}
        t={t}
      />
    </div>
  )
}
