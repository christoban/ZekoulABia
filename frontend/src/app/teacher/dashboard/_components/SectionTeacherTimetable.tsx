'use client'
import { useState, useEffect, useMemo } from 'react'
import { Calendar, RefreshCw, Coffee, Utensils, User as UserIcon, BookOpen, Layers } from 'lucide-react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useT } from '@/lib/i18n'
import { normalizeTimetableCellSlots } from '@/lib/timetableSlotGrouping'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  user?: UserInfo | null
}

export interface PeriodeGrille {
  ordre: number
  debut: string
  fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'
  duree: number
}

type SlotType = {
  subject: string
  classe: string
  teacher?: string
  room: string
  kind: string
  isMine: boolean
  groupId?: string | null
}
type CellSlots = SlotType[]

const DAY_NAMES = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']
const DAY_MAP: Record<string, number> = {
  LUNDI: 0, MARDI: 1, MERCREDI: 2, JEUDI: 3, VENDREDI: 4, SAMEDI: 5,
}

// Fallback skeleton standard si la grille n'a pas encore été configurée
const DEFAULT_SKELETON: PeriodeGrille[] = [
  { ordre: 1, debut: '07:30', fin: '08:25', type: 'COURS', duree: 55 },
  { ordre: 2, debut: '08:25', fin: '09:20', type: 'COURS', duree: 55 },
  { ordre: 0, debut: '09:20', fin: '09:35', type: 'PETITE_PAUSE', duree: 15 },
  { ordre: 3, debut: '09:35', fin: '10:30', type: 'COURS', duree: 55 },
  { ordre: 4, debut: '10:30', fin: '11:25', type: 'COURS', duree: 55 },
  { ordre: 5, debut: '11:25', fin: '12:20', type: 'COURS', duree: 55 },
  { ordre: 0, debut: '12:20', fin: '12:50', type: 'GRANDE_PAUSE', duree: 30 },
  { ordre: 6, debut: '12:50', fin: '13:45', type: 'COURS', duree: 55 },
  { ordre: 7, debut: '13:45', fin: '14:40', type: 'COURS', duree: 55 },
]

const EMPTY_CATCHUP = {
  open: false,
  classId: '',
  proposedDate: '',
  subjectId: '',
  proposedStartTime: '',
  proposedEndTime: '',
  reason: '',
  loading: false,
  error: '',
}

export default function SectionTeacherTimetable({ onToast, user }: Props) {
  const t = useT('teacher')
  const tcommon = useT('common')

  const [timetablesData, setTimetablesData] = useState<any[]>([])
  const [squelette, setSquelette] = useState<PeriodeGrille[]>(DEFAULT_SKELETON)
  const [joursActifs, setJoursActifs] = useState<string[]>(['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'])
  const [squeletteParJour, setSqueletteParJour] = useState<Record<string, PeriodeGrille[]>>({})

  // Mode de vue : 'MY_SCHEDULE' (Mon planning) ou classId d'une de ses classes
  const [selectedView, setSelectedView] = useState<string>('MY_SCHEDULE')

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [catchup, setCatchup] = useState(EMPTY_CATCHUP)
  const [catchupClasses, setCatchupClasses] = useState<{ id: string; name: string }[]>([])

  const userId = user?.id

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [res, gridRes] = await Promise.all([
        fetchApi('/api/v2/timetables', { credentials: 'include' }).then(r => r.json()),
        fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()).catch(() => ({ success: false })),
      ])

      if (res.success) {
        setTimetablesData(res.data || [])

        // Grille officielle de l'établissement
        if (gridRes?.success && gridRes.data) {
          if (Array.isArray(gridRes.data.squelette) && gridRes.data.squelette.length > 0) {
            setSquelette(gridRes.data.squelette)
          }
          if (Array.isArray(gridRes.data.config?.joursActifs) && gridRes.data.config.joursActifs.length > 0) {
            setJoursActifs(gridRes.data.config.joursActifs)
          }
          if (gridRes.data.squeletteParJour && typeof gridRes.data.squeletteParJour === 'object') {
            setSqueletteParJour(gridRes.data.squeletteParJour)
          }
        }
      } else {
        setError(t('timetable.error_loading'))
      }
    } catch (err: any) {
      setError(err.message || t('timetable.error_network'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [user])

  // Nuance stricte demandée : Ne lister QUE les classes où cet enseignant donne AU MOINS UN cours
  const myClasses = useMemo(() => {
    const classesMap = new Map<string, string>()
    timetablesData.forEach((tt: any) => {
      const hasMyCourse = (tt.slots || []).some((s: any) => userId && s.teacher?.id === userId)
      if (hasMyCourse && tt.class?.id) {
        classesMap.set(tt.class.id, tt.class.name || 'Classe')
      }
    })
    return Array.from(classesMap.entries()).map(([id, name]) => ({ id, name }))
  }, [timetablesData, userId])

  // Déterminer le nom de la vue courante (Mon planning ou nom de la classe)
  const currentViewTitle = useMemo(() => {
    if (selectedView === 'MY_SCHEDULE') return t('timetable.view_my_schedule')
    const found = myClasses.find(c => c.id === selectedView)
    return found ? `${t('timetable.view_by_class')} : ${found.name}` : t('timetable.view_my_schedule')
  }, [selectedView, myClasses, t])

  // Slots indexés par `${dayOfWeek}-${startTime}` selon le mode de vue actif
  const slots = useMemo(() => {
    const slotMap: Record<string, CellSlots> = {}

    if (selectedView === 'MY_SCHEDULE') {
      // Vue personnelle : uniquement ses propres cours dans toutes ses classes
      timetablesData.forEach((tt: any) => {
        (tt.slots || []).forEach((s: any) => {
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
      // Vue de la classe sélectionnée : tous les cours de la classe, avec ses cours en surbrillance
      const selectedTt = timetablesData.find((tt: any) => tt.class?.id === selectedView)
      if (selectedTt) {
        (selectedTt.slots || []).forEach((s: any) => {
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

  // Modal rattrapage
  const openCatchupModal = async () => {
    setCatchup({ ...EMPTY_CATCHUP, open: true })
    try {
      const res = await fetchApi('/api/v2/classes', { credentials: 'include' })
      const data = await res.json()
      setCatchupClasses(data.data || [])
    } catch {}
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

  // Jour sélectionné sur mobile (index dans joursActifs)
  const currentDayIdx = () => {
    const todayIndex = new Date().getDay()
    const mappedDay = todayIndex === 0 ? 6 : todayIndex - 1
    const foundIdx = joursActifs.findIndex(j => DAY_MAP[j] === mappedDay)
    return foundIdx >= 0 ? foundIdx : 0
  }
  const [selectedDay, setSelectedDay] = useState(currentDayIdx)

  useEffect(() => {
    // Si joursActifs change, vérifier que selectedDay reste valide
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

  const getDayLabel = (dayName: string) => {
    switch (dayName) {
      case 'LUNDI': return t('timetable.day_monday')
      case 'MARDI': return t('timetable.day_tuesday')
      case 'MERCREDI': return t('timetable.day_wednesday')
      case 'JEUDI': return t('timetable.day_thursday')
      case 'VENDREDI': return t('timetable.day_friday')
      case 'SAMEDI': return t('timetable.day_saturday')
      default: return dayName
    }
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
      {/* ── En-tête : Titre, Semaine et Actions ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
        <div>
          <div style={sTitle}>{t('timetable.title')}</div>
          <div style={sSub}>{getWeekRange()} · <span className="font-semibold text-[var(--primary)]">{currentViewTitle}</span></div>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2.5 flex-wrap">
          {/* Légende */}
          <div className="flex items-center gap-3">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--green)' }}>
              <div style={{ width: 9, height: 9, borderRadius: 2.5, background: 'var(--green-light)', border: '1.5px solid var(--green)' }} />
              {t('timetable.my_courses')}
            </span>
            {selectedView !== 'MY_SCHEDULE' && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--text3)' }}>
                <div style={{ width: 9, height: 9, borderRadius: 2.5, background: 'var(--surface)', border: '1.5px solid var(--border)' }} />
                {t('timetable.view_by_class')}
              </span>
            )}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 700, color: 'var(--amber)' }}>
              <Coffee size={12} />
              <span>Pauses</span>
            </span>
          </div>

          {/* Bouton rattrapage */}
          <button
            onClick={openCatchupModal}
            className="h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer ml-auto sm:ml-0"
            style={{ background: 'var(--surface)', color: 'var(--green)', border: '1px solid rgba(5,150,105,0.35)', fontFamily: 'inherit' }}
          >
            <Calendar size={13} strokeWidth={2} />
            <span>{t('timetable.catchup_request')}</span>
          </button>
        </div>
      </div>

      {/* ── BASCULE OPTION 2 AVEC NUANCE STRICTE : Uniquement les classes où l'enseignant donne cours ── */}
      <div className="p-2 sm:p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setSelectedView('MY_SCHEDULE')}
            className="h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all"
            style={{
              background: selectedView === 'MY_SCHEDULE' ? 'var(--primary)' : 'var(--bg)',
              color: selectedView === 'MY_SCHEDULE' ? 'white' : 'var(--text2)',
              border: `1px solid ${selectedView === 'MY_SCHEDULE' ? 'var(--primary)' : 'var(--border)'}`,
              boxShadow: selectedView === 'MY_SCHEDULE' ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              fontFamily: 'inherit',
            }}
          >
            <UserIcon size={13} />
            <span>{t('timetable.view_my_schedule')}</span>
          </button>

          {myClasses.length > 0 && (
            <div className="flex items-center gap-1.5 flex-1 sm:flex-initial">
              <span className="text-[11px] font-semibold text-[var(--text3)] hidden sm:inline">
                {t('timetable.view_by_class')} :
              </span>
              <select
                value={selectedView === 'MY_SCHEDULE' ? '' : selectedView}
                onChange={(e) => {
                  if (e.target.value) setSelectedView(e.target.value)
                  else setSelectedView('MY_SCHEDULE')
                }}
                className="h-8 px-2.5 rounded-lg text-xs font-bold border transition-all cursor-pointer outline-none w-full sm:w-auto"
                style={{
                  background: selectedView !== 'MY_SCHEDULE' ? 'linear-gradient(135deg,rgba(5,150,105,0.08),rgba(5,150,105,0.03))' : 'var(--bg)',
                  color: selectedView !== 'MY_SCHEDULE' ? 'var(--green2)' : 'var(--text2)',
                  borderColor: selectedView !== 'MY_SCHEDULE' ? 'var(--green)' : 'var(--border)',
                  fontFamily: 'inherit',
                }}
              >
                <option value="">{t('timetable.select_class_placeholder')}</option>
                {myClasses.map((c) => (
                  <option key={c.id} value={c.id}>
                    🏫 {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {selectedView !== 'MY_SCHEDULE' && (
          <div className="text-[11px] text-[var(--green)] font-medium bg-[var(--green-light)] px-2.5 py-1 rounded-md self-start sm:self-center">
            ★ Vos cours sont mis en surbrillance vive
          </div>
        )}
      </div>

      {/* ── Modal demande de rattrapage ── */}
      {catchup.open && (
        <div onClick={() => setCatchup(EMPTY_CATCHUP)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} className="px-4 py-5 md:px-6 md:py-6" style={{ background: 'var(--surface)', borderRadius: 14, width: 440, maxWidth: '94vw', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(0,0,0,0.18)' }}>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 14 }}>{t('timetable.catchup_title')}</div>
            <div style={catchSLb}>{t('timetable.catchup_class_label')}</div>
            <select style={catchSIn} value={catchup.classId} onChange={e => setCatchup(f => ({ ...f, classId: e.target.value }))}>
              <option value="">{t('timetable.catchup_class_placeholder')}</option>
              {catchupClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <div style={catchSLb}>{t('timetable.catchup_date_label')}</div>
            <input style={catchSIn} type="date" value={catchup.proposedDate} onChange={e => setCatchup(f => ({ ...f, proposedDate: e.target.value }))} />
            <div style={catchSLb}>{t('timetable.catchup_subject_label')}</div>
            <select style={catchSIn} value={catchup.subjectId} onChange={e => setCatchup(f => ({ ...f, subjectId: e.target.value }))}>
              <option value="">{t('timetable.catchup_subject_placeholder')}</option>
              {(user?.teacherProfile?.teacherSubjects || []).map(ts => (
                <option key={ts.subject.id} value={ts.subject.id}>{ts.subject.name}</option>
              ))}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div style={catchSLb}>{t('timetable.catchup_start_label')}</div>
                <input style={catchSIn} type="time" value={catchup.proposedStartTime} onChange={e => setCatchup(f => ({ ...f, proposedStartTime: e.target.value }))} />
              </div>
              <div>
                <div style={catchSLb}>{t('timetable.catchup_end_label')}</div>
                <input style={catchSIn} type="time" value={catchup.proposedEndTime} onChange={e => setCatchup(f => ({ ...f, proposedEndTime: e.target.value }))} />
              </div>
            </div>
            <div style={catchSLb}>{t('timetable.catchup_reason_label')}</div>
            <textarea style={{ ...catchSIn, minHeight: 60, resize: 'vertical' }} value={catchup.reason} onChange={e => setCatchup(f => ({ ...f, reason: e.target.value }))} placeholder={t('timetable.catchup_reason_placeholder')} />
            {catchup.error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', borderRadius: 6, padding: '6px 10px', fontSize: 12, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>{catchup.error}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button style={{ flex: 1, padding: '7px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }} onClick={() => setCatchup(EMPTY_CATCHUP)}>{t('timetable.catchup_cancel')}</button>
              <button style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '7px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: catchup.loading ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: catchup.loading ? 0.7 : 1 }} onClick={submitCatchup} disabled={catchup.loading}>
                <Calendar size={13} strokeWidth={2} />{catchup.loading ? t('timetable.catchup_submit_loading') : t('timetable.catchup_submit')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── VUE MOBILE : Sélecteur de jour en pilules + Chronologie verticale avec Pauses ── */}
      <div className="md:hidden space-y-3">
        {/* Pilules des jours */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {joursActifs.map((dayName, di) => {
            const isSelected = selectedDay === di
            return (
              <button
                key={dayName}
                onClick={() => setSelectedDay(di)}
                className="flex-1 min-w-[58px] h-10 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer"
                style={{
                  background: isSelected ? 'var(--primary)' : 'var(--surface)',
                  color: isSelected ? 'white' : 'var(--text2)',
                  border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                  boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <span>{getDayLabel(dayName).slice(0, 3)}</span>
              </button>
            )
          })}
        </div>

        {/* Timeline verticale avec cours et pauses */}
        <div className="space-y-2">
          {squeletteDuJour.map((periode, pIdx) => {
            // Bandeau de pause (Petite ou Grande pause)
            if (periode.type === 'PETITE_PAUSE' || periode.type === 'GRANDE_PAUSE') {
              const isSnack = periode.type === 'PETITE_PAUSE'
              const Icon = isSnack ? Coffee : Utensils
              const label = isSnack ? t('timetable.pause_snack') : t('timetable.pause_lunch')
              return (
                <div
                  key={`mobile-pause-${pIdx}-${periode.debut}`}
                  className="flex items-center justify-between px-3.5 py-2.5 rounded-xl border border-dashed text-xs font-bold"
                  style={{
                    background: isSnack ? 'rgba(245, 158, 11, 0.08)' : 'rgba(59, 130, 246, 0.08)',
                    borderColor: isSnack ? 'rgba(245, 158, 11, 0.35)' : 'rgba(59, 130, 246, 0.35)',
                    color: isSnack ? 'var(--amber)' : 'var(--blue)',
                  }}
                >
                  <div className="flex items-center gap-2">
                    <Icon size={15} />
                    <span>{label}</span>
                  </div>
                  <span className="text-[11px] font-semibold opacity-90">
                    {periode.debut} - {periode.fin} ({periode.duree} {t('timetable.min')})
                  </span>
                </div>
              )
            }

            // Période de cours
            const dayNum = DAY_MAP[activeDayName] ?? 0
            const cell = slots[`${dayNum}-${periode.debut}`]
            const visibleCell = cell ? normalizeTimetableCellSlots(cell) : []
            const hasSlots = visibleCell.length > 0

            return (
              <div
                key={`mobile-slot-${pIdx}-${periode.debut}`}
                className="flex gap-2.5 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] items-stretch"
              >
                {/* Badge horaire tactile */}
                <div className="w-16 shrink-0 flex flex-col justify-center items-center rounded-lg bg-[var(--bg)] border border-[var(--border)] px-1 py-1.5 text-center">
                  <span className="text-[11.5px] font-extrabold text-[var(--text)]">
                    {periode.debut}
                  </span>
                  <span className="text-[9.5px] font-semibold text-[var(--text3)] mt-0.5">
                    {periode.fin}
                  </span>
                </div>

                {/* Contenu du créneau */}
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  {hasSlots ? (
                    <div className="space-y-1.5">
                      {visibleCell.map((slot, index) => {
                        const isMine = slot.isMine
                        return (
                          <div
                            key={`${slot.groupId ?? 'class'}-${slot.subject}-${index}`}
                            className="p-2.5 rounded-lg border-l-4 transition-all"
                            style={{
                              background: isMine
                                ? 'linear-gradient(135deg,rgba(5,150,105,0.12),rgba(5,150,105,0.05))'
                                : 'var(--surface)',
                              borderLeftColor: isMine ? 'var(--green)' : 'var(--border2)',
                              border: isMine ? '1px solid rgba(5,150,105,0.2)' : '1px solid var(--border)',
                              borderLeftWidth: 4,
                            }}
                            onClick={() => onToast(`${slot.subject} — ${slot.classe}`, 'info')}
                          >
                            <div className="flex items-center justify-between gap-1.5">
                              <span
                                className="text-[13px] font-bold truncate"
                                style={{ color: isMine ? 'var(--green2)' : 'var(--text)' }}
                              >
                                {slot.subject}
                              </span>
                              {isMine && selectedView !== 'MY_SCHEDULE' && (
                                <span className="bg-[var(--green)] text-white text-[9.5px] font-extrabold px-1.5 py-0.5 rounded shadow-xs shrink-0">
                                  {t('timetable.badge_my_course')}
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-2.5 mt-1 text-[11px] text-[var(--text3)] font-semibold flex-wrap">
                              {slot.classe && <span>🏫 {slot.classe}</span>}
                              {slot.teacher && !isMine && <span>👤 {slot.teacher}</span>}
                              {slot.room && <span>· {t('timetable.roomLabel')} {slot.room}</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--text3)] italic py-2 px-1">
                      {selectedView === 'MY_SCHEDULE' ? t('timetable.freeTime') : t('timetable.no_course')}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── VUE DESKTOP : Grille complète classique avec Pauses fusionnées et surbrillance ── */}
      <div className="hidden md:block" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ ...thSt, width: 85 }}>{t('timetable.header_schedule')}</th>
                {joursActifs.map(dayName => (
                  <th key={dayName} style={thSt}>
                    {getDayLabel(dayName)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {squelette.map((periode, pIdx) => {
                // Ligne de Pause fusionnée
                if (periode.type === 'PETITE_PAUSE' || periode.type === 'GRANDE_PAUSE') {
                  const isSnack = periode.type === 'PETITE_PAUSE'
                  const Icon = isSnack ? Coffee : Utensils
                  const label = isSnack ? t('timetable.pause_snack') : t('timetable.pause_lunch')
                  return (
                    <tr key={`desktop-pause-${pIdx}-${periode.debut}`}>
                      <td
                        colSpan={joursActifs.length + 1}
                        style={{
                          padding: '6px 12px',
                          background: isSnack ? 'rgba(245, 158, 11, 0.07)' : 'rgba(59, 130, 246, 0.07)',
                          border: '1px solid var(--border)',
                          textAlign: 'center',
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 11.5, fontWeight: 700, color: isSnack ? 'var(--amber)' : 'var(--blue)' }}>
                          <Icon size={14} />
                          <span>{label}</span>
                          <span style={{ fontSize: 10.5, opacity: 0.85, fontWeight: 600 }}>
                            ({periode.debut} - {periode.fin} · {periode.duree} {t('timetable.min')})
                          </span>
                        </div>
                      </td>
                    </tr>
                  )
                }

                // Ligne de cours normale
                return (
                  <tr key={`desktop-row-${pIdx}-${periode.debut}`}>
                    {/* Colonne horaire */}
                    <td style={{ padding: '6px 8px', background: 'var(--bg2)', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {periode.debut}<br /><span style={{ fontSize: 10, color: 'var(--text3)' }}>{periode.fin}</span>
                    </td>

                    {/* Colonnes des jours */}
                    {joursActifs.map((dayName) => {
                      const dayNum = DAY_MAP[dayName] ?? 0
                      const cell = slots[`${dayNum}-${periode.debut}`]
                      const visibleCell = cell ? normalizeTimetableCellSlots(cell) : []

                      return (
                        <td key={dayName} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 120, height: 56 }}>
                          {visibleCell.length > 0 ? (
                            <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                              {visibleCell.map((slot, index) => {
                                const isMine = slot.isMine
                                return (
                                  <div
                                    key={`${slot.groupId ?? 'class'}-${slot.subject}-${index}`}
                                    style={{
                                      padding: '6px 8px',
                                      cursor: 'pointer',
                                      marginBottom: index < visibleCell.length - 1 ? 2 : 0,
                                      background: isMine
                                        ? 'linear-gradient(135deg,rgba(5,150,105,0.12),rgba(5,150,105,0.05))'
                                        : 'var(--surface)',
                                      borderLeft: isMine ? '3px solid var(--green)' : '3px solid var(--border2)',
                                      flex: 1,
                                    }}
                                    onClick={() => onToast(`${slot.subject} — ${slot.classe}`, 'info')}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                      <div style={{ fontSize: 12.5, fontWeight: 700, color: isMine ? 'var(--green2)' : 'var(--text)', lineHeight: 1.2 }}>
                                        {slot.subject}
                                      </div>
                                      {isMine && selectedView !== 'MY_SCHEDULE' && (
                                        <span style={{ background: 'var(--green)', color: 'white', fontSize: 9, fontWeight: 800, padding: '1px 4px', borderRadius: 3 }}>
                                          {t('timetable.badge_my_course')}
                                        </span>
                                      )}
                                    </div>

                                    {slot.classe && (
                                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontWeight: 600 }}>
                                        {slot.classe}
                                      </div>
                                    )}

                                    {slot.teacher && !isMine && (
                                      <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                                        <UserIcon size={10} />
                                        <span>{slot.teacher}</span>
                                      </div>
                                    )}

                                    {slot.room && (
                                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>
                                        {t('timetable.roomLabel')} {slot.room}
                                      </div>
                                    )}
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div style={{ height: '100%', minHeight: 52, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border2)', fontSize: 15 }}>
                              ·
                            </div>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const thSt: React.CSSProperties = { padding: '8px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' }
const catchSLb: React.CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }
const catchSIn: React.CSSProperties = { width: '100%', minHeight: 36, padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10, outline: 'none' }