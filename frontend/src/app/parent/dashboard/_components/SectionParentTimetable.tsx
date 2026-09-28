'use client'
import { useCallback, useState } from 'react'
import { Clock, MapPin, User as UserIcon } from 'lucide-react'
import type { ChildWithStats } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'
import { groupTimetableSlotsForStudent, normalizeTimetableCellSlots } from '@/lib/timetableSlotGrouping'
import type { TimetableGroupSlot } from '@/lib/timetableSlotGrouping'

interface Props {
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
  userId?: string
}

const TIMES = ['07:30', '08:30', '09:30', '10:30', '12:00', '13:00', '14:00']
const TIMES_END = ['08:30', '09:30', '10:30', '11:30', '13:00', '14:00', '15:00']

type SlotType = { subject: string; teacher: string; room: string; kind: string; color: string; groupId?: string | null; unassigned?: boolean }
type RawSlot = TimetableGroupSlot & { subject?: { name?: string | null } | null; teacher?: { firstName: string; lastName: string } | null; room?: string | null; kind?: string | null }
type CellSlots = SlotType[]

interface TimetableData {
  children: ChildWithStats[]
  slotsByChild: Record<string, Record<string, CellSlots>>
  classNames: Record<string, string>
}

function CacheBadge({ cachedAt, label }: { cachedAt: number | null; label: string }) {
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
      {label.replace('{date}', date)}
    </div>
  )
}

function buildSlots(data: any[], groupIds: string[], unassignedLabel: string): Record<string, CellSlots> {
  const slotMap: Record<string, CellSlots> = {}
  const colors = ['var(--green)', 'var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--primary)', 'var(--red)', 'var(--orange)']
  let colorIdx = 0
  const subjectColors: Record<string, string> = {}
  const rawSlots: RawSlot[] = data.flatMap((tt: { slots?: RawSlot[] }) => tt.slots ?? [])

  for (const entries of groupTimetableSlotsForStudent(rawSlots, groupIds).values()) {
    const first = entries[0]
    const startIdx = TIMES.indexOf(first.startTime)
    if (startIdx === -1) continue
    const key = `${first.dayOfWeek}-${startIdx}`
    slotMap[key] = entries.map(entry => {
      if ('unassigned' in entry) {
        return {
          subject: unassignedLabel,
          teacher: '',
          room: '',
          kind: 'GROUP_UNASSIGNED',
          color: 'var(--text3)',
          unassigned: true,
        }
      }
      const subName = entry.subject?.name || ''
      if (subName && !subjectColors[subName]) { subjectColors[subName] = colors[colorIdx % colors.length]; colorIdx++ }
      return {
        subject: subName,
        teacher: entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : '',
        room: entry.room || '',
        kind: entry.kind || 'CLASS',
        color: subjectColors[subName] || 'var(--green)',
        groupId: entry.groupId,
      }
    })
  }
  return slotMap
}

export default function SectionParentTimetable({ onToast, userId }: Props) {
  const t = useT('parent')
  const [selectedChild, setSelectedChild] = useState(0)

  // Jour sélectionné sur mobile (par défaut aujourd'hui si lun-ven, sinon 0 = lundi)
  const currentDayIdx = () => {
    const d = new Date().getDay()
    return (d >= 1 && d <= 5) ? d - 1 : 0
  }
  const [selectedDay, setSelectedDay] = useState(currentDayIdx)

  const cacheKey = userId ? `parent:timetable:${userId}` : ''
  const fetchFn = useCallback(async (): Promise<TimetableData> => {
    const childrenRes = await fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json())
    if (!childrenRes.success) throw new Error(t('children.errorLoadChildren'))
    const children: ChildWithStats[] = childrenRes.data

    const slotsByChild: Record<string, Record<string, CellSlots>> = {}
    const classNames: Record<string, string> = {}

    await Promise.all(children.map(async (child) => {
      if (!child.classeId) { slotsByChild[child.studentId] = {}; classNames[child.studentId] = child.classeNom || '—'; return }
      classNames[child.studentId] = child.classeNom || ''
      try {
         const ttRes = await fetchApi(`/api/v2/timetables?classId=${child.classeId}`, { credentials: 'include' }).then(r => r.json())
         slotsByChild[child.studentId] = ttRes.success ? buildSlots(ttRes.data, child.groupIds ?? [], t('timetable.notAssignedToGroup')) : {}
      } catch {
        slotsByChild[child.studentId] = {}
      }
    }))

    return { children, slotsByChild, classNames }
  }, [userId, t])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<TimetableData>(cacheKey, fetchFn)

  const getWeekRange = () => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - now.getDay() + 1)
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return t('timetable.weekRange').replace('{start}', fmt(monday)).replace('{end}', fmt(friday))
  }

  if (loading) {
    return (
      <div style={{ padding: '20px 24px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 600 }}>{t('loading')}</div>
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  if (error) {
    return (
      <div className="px-3.5 py-3.5 sm:px-6 sm:py-5" style={{ height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 20, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 12.5, fontWeight: 700, marginBottom: 10 }}>{error}</div>
          <button onClick={refetch}
            className="h-10 sm:h-9 px-4"
            style={{ borderRadius: 7, fontSize: 11.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('retry')}
          </button>
        </div>
      </div>
    )
  }

  const children = data?.children ?? []
  const child = children[selectedChild]
  const slots = child ? (data?.slotsByChild[child.studentId] ?? {}) : {}
  const className = child ? (data?.classNames[child.studentId] ?? '') : ''
  const DAYS = t('timetable.days').split(',')

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: fromCache ? 4 : 8 }}>
        <div style={sTitle}>{t('timetable.title')}</div>
        <div style={sSub}>{className} · {getWeekRange()}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} label={t('cacheBadge')} />}

      {/* Sélecteur d'enfant tactile scrollable */}
      {children.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {children.map((c, i) => {
            const active = selectedChild === i
            return (
              <button
                key={c.studentId}
                onClick={() => setSelectedChild(i)}
                className="h-10 sm:h-9 px-3.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
                style={{
                  border: '1.5px solid',
                  borderColor: active ? 'var(--green)' : 'var(--border2)',
                  background: active ? 'var(--green-light)' : 'var(--surface)',
                  color: active ? 'var(--green)' : 'var(--text2)',
                }}
              >
                {c.prenom} {c.nom}
              </button>
            )
          })}
        </div>
      )}

      {/* ── VUE MOBILE: Sélecteur de jour en pilules + Chronologie verticale ── */}
      <div className="md:hidden space-y-3">
        {/* Pilules des jours de la semaine */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
          {DAYS.map((dayName, di) => {
            const isSelected = selectedDay === di
            return (
              <button
                key={di}
                onClick={() => setSelectedDay(di)}
                className="flex-1 min-w-[58px] h-10 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer"
                style={{
                  background: isSelected ? 'var(--primary)' : 'var(--surface)',
                  color: isSelected ? 'white' : 'var(--text2)',
                  border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                  boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <span>{dayName.slice(0, 3)}</span>
              </button>
            )
          })}
        </div>

        {/* Timeline des créneaux pour le jour sélectionné */}
        <div className="space-y-2">
          {TIMES.map((time, ti) => {
            const cell = slots[`${selectedDay}-${ti}`]
            const visibleCell = cell ? normalizeTimetableCellSlots(cell) : []
            const hasSlots = visibleCell.length > 0

            return (
              <div
                key={ti}
                className="flex gap-2.5 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] items-stretch"
              >
                {/* Badge horaire tactile */}
                <div className="w-16 shrink-0 flex flex-col justify-center items-center rounded-lg bg-[var(--bg)] border border-[var(--border)] px-1 py-1.5 text-center">
                  <span className="text-[11.5px] font-extrabold text-[var(--text)] flex items-center gap-1">
                    <Clock size={11} className="text-[var(--text3)]" />
                    {time}
                  </span>
                  <span className="text-[9.5px] font-semibold text-[var(--text3)] mt-0.5">
                    {TIMES_END[ti]}
                  </span>
                </div>

                {/* Contenu du créneau */}
                <div className="flex-1 flex flex-col justify-center min-w-0">
                  {hasSlots ? (
                    <div className="space-y-1.5">
                      {visibleCell.map((slot, sIdx) => {
                        const isFree = slot.kind === 'FREE'
                        return (
                          <div
                            key={sIdx}
                            className="p-2 rounded-lg border-l-4"
                            style={{
                              background: isFree ? 'var(--blue-light)' : `${slot.color}15`,
                              borderLeftColor: isFree ? 'var(--blue)' : slot.color,
                            }}
                          >
                            <div className="text-[12.5px] font-bold truncate" style={{ color: isFree ? 'var(--blue)' : slot.color }}>
                              {isFree ? t('timetable.freeTime') : slot.subject}
                            </div>
                            {!isFree && (slot.teacher || slot.room) && (
                              <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--text3)]">
                                {slot.teacher && (
                                  <span className="flex items-center gap-1 truncate">
                                    <UserIcon size={11} /> {slot.teacher}
                                  </span>
                                )}
                                {slot.room && (
                                  <span className="flex items-center gap-1 shrink-0 font-medium">
                                    <MapPin size={11} /> {slot.room}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-[var(--text3)] italic py-2 px-1">
                      {t('timetable.freeTime')}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── VUE DESKTOP: Grille complète 5 jours × 7 créneaux (intacte) ── */}
      <div className="hidden md:block" style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ ...thSt, width: 85 }}>{t('timetable.schedule')}</th>
                {DAYS.map((d, i) => <th key={i} style={thSt}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {TIMES.map((time, ti) => (
                <tr key={ti}>
                  <td style={{ padding: '6px 8px', background: 'var(--bg2)', fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {time}<br /><span style={{ fontSize: 10, color: 'var(--border2)' }}>{TIMES_END[ti]}</span>
                  </td>
                   {DAYS.map((_, di) => {
                     const cell = slots[`${di}-${ti}`]
                     const visibleCell = cell ? normalizeTimetableCellSlots(cell) : []
                     return (
                       <td key={di} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 110, height: 56 }}>
                         {visibleCell.length > 0 ? (
                           <div style={{ height: '100%' }}>
                             {visibleCell.map((slot, index) => (
                               <div key={`${slot.groupId ?? 'class'}-${slot.subject}-${index}`} style={{ padding: '6px 8px', background: slot.kind === 'FREE' ? 'var(--blue-light)' : `${slot.color}12`, borderLeft: `3px solid ${slot.kind === 'FREE' ? 'var(--blue)' : slot.color}`, marginBottom: index < visibleCell.length - 1 ? 2 : 0, ...(slot.kind === 'FREE' ? { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%', minHeight: '56px', boxSizing: 'border-box' } : {}) }}>
                                 {slot.kind === 'FREE' ? (
                                   <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--blue)' }}>{t('timetable.freeTime')}</div>
                                 ) : (
                                   <>
                                     <div style={{ fontSize: 12, fontWeight: 800, color: slot.color }}>{slot.subject}</div>
                                     {slot.teacher && <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 2 }}>{slot.teacher}</div>}
                                     {slot.room && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{t('timetable.roomLabel')} {slot.room}</div>}
                                   </>
                                 )}
                               </div>
                             ))}
                           </div>
                         ) : (
                           <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--border2)', fontSize: 16 }}>·</div>
                         )}
                       </td>
                     )
                   })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
const sSub: React.CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
const thSt: React.CSSProperties = { padding: '7px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.4px' }

