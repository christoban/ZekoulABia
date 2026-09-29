'use client'
import { useCallback, useState } from 'react'
import { Clock, MapPin, User as UserIcon, Coffee, Utensils } from 'lucide-react'
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

export interface PeriodeGrille {
  ordre: number
  debut: string
  fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'
  duree: number
}

type SlotType = { subject: string; teacher: string; room: string; kind: string; color: string; groupId?: string | null; unassigned?: boolean }
type RawSlot = TimetableGroupSlot & { subject?: { name?: string | null } | null; teacher?: { firstName: string; lastName: string } | null; room?: string | null; kind?: string | null }
type CellSlots = SlotType[]

const DAY_NAMES = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']
const DAY_MAP: Record<string, number> = {
  LUNDI: 0, MARDI: 1, MERCREDI: 2, JEUDI: 3, VENDREDI: 4, SAMEDI: 5,
}

// Fallback skeleton standard
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

interface TimetableData {
  children: ChildWithStats[]
  slotsByChild: Record<string, Record<string, CellSlots>>
  classNames: Record<string, string>
  squelette: PeriodeGrille[]
  joursActifs: string[]
  squeletteParJour: Record<string, PeriodeGrille[]>
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
    // Indexation précise jour-heureDebut (ex: "0-07:30")
    const key = `${first.dayOfWeek}-${first.startTime}`
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

  // Jour sélectionné sur mobile
  const currentDayIdx = () => {
    const d = new Date().getDay()
    return (d >= 1 && d <= 5) ? d - 1 : 0
  }
  const [selectedDay, setSelectedDay] = useState(currentDayIdx)

  const cacheKey = userId ? `parent:timetable:v2:${userId}` : ''
  const fetchFn = useCallback(async (): Promise<TimetableData> => {
    const [childrenRes, gridRes] = await Promise.all([
      fetchApi('/api/v2/parent/children', { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' }).then(r => r.json()).catch(() => ({ success: false })),
    ])

    if (!childrenRes.success) throw new Error(t('children.errorLoadChildren'))
    const children: ChildWithStats[] = childrenRes.data

    let squelette: PeriodeGrille[] = DEFAULT_SKELETON
    let joursActifs: string[] = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']
    let squeletteParJour: Record<string, PeriodeGrille[]> = {}

    if (gridRes?.success && gridRes.data) {
      if (Array.isArray(gridRes.data.squelette) && gridRes.data.squelette.length > 0) {
        squelette = gridRes.data.squelette
      }
      if (Array.isArray(gridRes.data.config?.joursActifs) && gridRes.data.config.joursActifs.length > 0) {
        joursActifs = gridRes.data.config.joursActifs
      }
      if (gridRes.data.squeletteParJour && typeof gridRes.data.squeletteParJour === 'object') {
        squeletteParJour = gridRes.data.squeletteParJour
      }
    }

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

    return { children, slotsByChild, classNames, squelette, joursActifs, squeletteParJour }
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
  const squelette = data?.squelette ?? DEFAULT_SKELETON
  const joursActifs = data?.joursActifs ?? ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']
  const squeletteParJour = data?.squeletteParJour ?? {}

  const activeDayName = DAY_NAMES[selectedDay] || 'LUNDI'
  const activeDayPeriods = squeletteParJour[activeDayName] || squelette

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: fromCache ? 4 : 8 }}>
        <div style={sTitle}>{t('timetable.title')}</div>
        <div style={sSub}>{className} · {getWeekRange()}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} label={t('cacheBadge')} />}

      {/* Sélecteur d'enfant tactile */}
      {children.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {children.map((c, i) => {
            const active = selectedChild === i
            return (
              <button
                key={c.studentId}
                onClick={() => setSelectedChild(i)}
                className="h-10 sm:h-9 px-3.5 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
                style={{
                  border: '1.5px solid',
                  borderColor: active ? 'var(--primary)' : 'var(--border)',
                  background: active ? 'var(--primary-light)' : 'var(--surface)',
                  color: active ? 'var(--primary)' : 'var(--text2)',
                }}
              >
                {c.prenom} {c.nom}
              </button>
            )
          })}
        </div>
      )}

      {/* ── VUE MOBILE: Sélecteur de jour en pilules + Chronologie avec Pauses ── */}
      <div className="md:hidden space-y-3">
        {/* Pilules des jours de la semaine */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {joursActifs.map((j) => {
            const di = DAY_MAP[j] ?? 0
            const isSelected = selectedDay === di
            return (
              <button
                key={j}
                onClick={() => setSelectedDay(di)}
                className="flex-1 min-w-[58px] h-10 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer"
                style={{
                  background: isSelected ? 'var(--primary)' : 'var(--surface)',
                  color: isSelected ? 'white' : 'var(--text2)',
                  border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                  boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                <span>{j.slice(0, 3)}</span>
              </button>
            )
          })}
        </div>

        {/* Timeline des créneaux pour le jour sélectionné */}
        <div className="space-y-2">
          {activeDayPeriods.map((periode, pIdx) => {
            // A: Petite Pause (Récréation)
            if (periode.type === 'PETITE_PAUSE') {
              return (
                <div
                  key={`pause-${pIdx}`}
                  className="rounded-xl border px-3.5 py-2.5 flex items-center justify-between shadow-xs bg-[var(--amber-light)] border-[var(--amber)]/30 text-[var(--amber)]"
                >
                  <div className="flex items-center gap-2">
                    <Coffee size={15} className="shrink-0" />
                    <span className="text-xs font-bold">Petite pause (Récréation)</span>
                  </div>
                  <span className="text-[11px] font-bold">
                    {periode.debut} - {periode.fin} ({periode.duree} min)
                  </span>
                </div>
              )
            }

            // B: Grande Pause (Déjeuner)
            if (periode.type === 'GRANDE_PAUSE') {
              return (
                <div
                  key={`pause-${pIdx}`}
                  className="rounded-xl border px-3.5 py-2.5 flex items-center justify-between shadow-xs bg-[var(--amber-light)] border-[var(--amber)]/40 text-[var(--amber)]"
                >
                  <div className="flex items-center gap-2">
                    <Utensils size={15} className="shrink-0" />
                    <span className="text-xs font-bold">Grande pause (Déjeuner)</span>
                  </div>
                  <span className="text-[11px] font-bold">
                    {periode.debut} - {periode.fin} ({periode.duree} min)
                  </span>
                </div>
              )
            }

            // C: Période de cours
            const cell = slots[`${selectedDay}-${periode.debut}`]
            const visibleCell = cell ? normalizeTimetableCellSlots(cell) : []
            const hasSlots = visibleCell.length > 0

            return (
              <div
                key={`cours-${pIdx}`}
                className="flex gap-2.5 p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] items-stretch shadow-xs"
              >
                {/* Badge horaire officiel */}
                <div className="w-16 shrink-0 flex flex-col justify-center items-center rounded-lg bg-[var(--bg2)] border border-[var(--border)] px-1 py-1.5 text-center">
                  <span className="text-[11.5px] font-extrabold text-[var(--text)] flex items-center gap-1">
                    <Clock size={11} className="text-[var(--text3)]" />
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
                    <div className="text-xs text-[var(--text3)] italic py-1 px-1">
                      {t('timetable.freeTime')}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── VUE DESKTOP: Grille complète avec Pauses intégrées ── */}
      <div className="hidden md:block rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-xs">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ ...thSt, width: 95 }}>{t('timetable.schedule')}</th>
                {joursActifs.map((d) => <th key={d} style={thSt}>{d}</th>)}
              </tr>
            </thead>
            <tbody>
              {squelette.map((periode, pIdx) => {
                // Petite Pause
                if (periode.type === 'PETITE_PAUSE') {
                  return (
                    <tr key={`pause-${pIdx}`}>
                      <td
                        colSpan={joursActifs.length + 1}
                        className="text-center py-2 px-3 text-xs font-bold bg-[var(--amber-light)] border-t border-b border-[var(--border)] text-[var(--amber)]"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Coffee size={14} />
                          <span>Petite pause (Récréation) — {periode.debut} à {periode.fin} ({periode.duree} min)</span>
                        </span>
                      </td>
                    </tr>
                  )
                }

                // Grande Pause
                if (periode.type === 'GRANDE_PAUSE') {
                  return (
                    <tr key={`pause-${pIdx}`}>
                      <td
                        colSpan={joursActifs.length + 1}
                        className="text-center py-2 px-3 text-xs font-bold bg-[var(--amber-light)] border-t border-b border-[var(--border)] text-[var(--amber)]"
                      >
                        <span className="inline-flex items-center gap-2">
                          <Utensils size={14} />
                          <span>Grande pause (Déjeuner) — {periode.debut} à {periode.fin} ({periode.duree} min)</span>
                        </span>
                      </td>
                    </tr>
                  )
                }

                // Cours
                return (
                  <tr key={`cours-${pIdx}`}>
                    <td style={{ padding: '6px 8px', background: 'var(--bg2)', fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {periode.debut}<br /><span style={{ fontSize: 10, color: 'var(--text3)', opacity: 0.8 }}>{periode.fin}</span>
                    </td>
                    {joursActifs.map((jour) => {
                      const di = DAY_MAP[jour] ?? 0
                      const cell = slots[`${di}-${periode.debut}`]
                      const visibleCell = cell ? normalizeTimetableCellSlots(cell) : []
                      const courseActive = (squeletteParJour[jour] ?? squelette).some(
                        pj => pj.type === 'COURS' && pj.debut === periode.debut && pj.fin === periode.fin
                      )

                      return (
                        <td key={jour} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 110, height: 60, opacity: courseActive ? 1 : 0.35 }}>
                          {!courseActive ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>—</div>
                          ) : visibleCell.length > 0 ? (
                            <div style={{ height: '100%', padding: 2 }}>
                              {visibleCell.map((slot, index) => (
                                <div key={`${slot.groupId ?? 'class'}-${slot.subject}-${index}`} style={{ padding: '5px 7px', background: slot.kind === 'FREE' ? 'var(--blue-light)' : `${slot.color}15`, borderLeft: `3px solid ${slot.kind === 'FREE' ? 'var(--blue)' : slot.color}`, marginBottom: index < visibleCell.length - 1 ? 2 : 0, borderRadius: 4 }}>
                                  {slot.kind === 'FREE' ? (
                                    <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--blue)' }}>{t('timetable.freeTime')}</div>
                                  ) : (
                                    <>
                                      <div style={{ fontSize: 12, fontWeight: 800, color: slot.color }} className="truncate">{slot.subject}</div>
                                      {slot.teacher && <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 1 }} className="truncate">{slot.teacher}</div>}
                                      {slot.room && <div style={{ fontSize: 9.5, color: 'var(--text2)', marginTop: 1 }} className="truncate font-semibold">{t('timetable.roomLabel')} {slot.room}</div>}
                                    </>
                                  )}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', opacity: 0.4, fontSize: 16 }}>·</div>
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
const thSt: React.CSSProperties = { padding: '7px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.4px' }
