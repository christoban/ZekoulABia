'use client'
import { useState, useCallback } from 'react'
import type { UserInfo } from '../_types'
import { fetchApi } from '@/lib/fetchApi'
import { useCachedFetch } from '@/hooks/useCachedFetch'
import OfflineEmptyState from '@/components/OfflineEmptyState'
import { useT } from '@/lib/i18n'
import { getCachedData, putCachedData } from '@/lib/offline/db'
import { groupTimetableSlotsForStudent, normalizeTimetableCellSlots } from '@/lib/timetableSlotGrouping'
import type { TimetableGroupSlot } from '@/lib/timetableSlotGrouping'
import { Coffee, Utensils, MapPin, User as UserIcon } from 'lucide-react'

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

type SlotType = { subject: string; teacher: string; room: string; kind: string; color: string; groupId?: string | null; unassigned?: boolean }
type RawSlot = TimetableGroupSlot & { subject?: { name?: string | null } | null; teacher?: { firstName: string; lastName: string } | null; room?: string | null; kind?: string | null }
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

interface TimetableData {
  slots: Record<string, CellSlots>
  className: string
  squelette: PeriodeGrille[]
  joursActifs: string[]
  squeletteParJour: Record<string, PeriodeGrille[]>
}

function CacheBadge({ cachedAt }: { cachedAt: number | null }) {
  const t = useT('student')
  if (!cachedAt) return null
  const date = new Date(cachedAt).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
  return (
    <div style={{ background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 6, padding: '3px 8px', fontSize: 11.5, fontWeight: 600, color: 'var(--amber)', display: 'inline-flex', alignItems: 'center', gap: 5, marginBottom: 12 }}>
      {t('common.offline_badge').replace('{date}', date)}
    </div>
  )
}

export default function SectionStudentTimetable({ onToast, user }: Props) {
  const t = useT('student')
  const tcommon = useT('common')
  const classId = user?.studentProfile?.class?.id ?? ''
  const groupIds = user?.studentProfile?.groupIds ?? []
  const cacheKey = classId ? `student:timetable:v2:${classId}:${[...groupIds].sort().join(',')}` : ''

  const fetchFn = useCallback(async (): Promise<TimetableData> => {
    if (!classId) throw new Error(t('timetable.no_class'))

    const [res, gridRes] = await Promise.all([
      fetchApi(`/api/v2/timetables?classId=${classId}`, { credentials: 'include' }).then(r => r.json()),
      fetchApi('/api/v2/timetable-grid-config', { credentials: 'include' })
        .then(async r => {
          const json = await r.json()
          if (json.success && json.data) {
            await putCachedData('student:timetable-grid-config', json.data)
          }
          return json
        })
        .catch(async () => {
          const cached = await getCachedData<any>('student:timetable-grid-config')
          return cached?.data ? { success: true, data: cached.data } : { success: false }
        }),
    ])

    if (!res.success) throw new Error(t('timetable.load_error'))

    // Extraction de la grille horaire officielle
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

    const slotMap: Record<string, CellSlots> = {}
    const colors = ['var(--green)', 'var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--primary)', 'var(--red)', 'var(--orange)']
    let colorIdx = 0
    const subjectColors: Record<string, string> = {}
    const rawSlots: RawSlot[] = res.data.flatMap((tt: { slots?: RawSlot[] }) => tt.slots ?? [])

    for (const entries of groupTimetableSlotsForStudent(rawSlots, groupIds).values()) {
      const first = entries[0]
      // Clé précise jour-heureDebut (ex: "0-07:30")
      const key = `${first.dayOfWeek}-${first.startTime}`
      slotMap[key] = entries.map(entry => {
        if ('unassigned' in entry) {
          return {
            subject: t('timetable.notAssignedToGroup'),
            teacher: '',
            room: '',
            kind: 'GROUP_UNASSIGNED',
            color: 'var(--text3)',
            unassigned: true,
          }
        }
        const subName = entry.subject?.name || ''
        if (subName && !subjectColors[subName]) {
          subjectColors[subName] = colors[colorIdx % colors.length]
          colorIdx++
        }
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

    return {
      slots: slotMap,
      className: user?.studentProfile?.class?.name || '',
      squelette,
      joursActifs,
      squeletteParJour,
    }
  }, [classId, groupIds, t, user])

  const { data, loading, error, fromCache, cachedAt, refetch } = useCachedFetch<TimetableData>(cacheKey, fetchFn)

  const getWeekRange = () => {
    const now = new Date()
    const monday = new Date(now)
    monday.setDate(now.getDate() - now.getDay() + 1)
    const friday = new Date(monday)
    friday.setDate(monday.getDate() + 4)
    const fmt = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
    return `${t('timetable.week_prefix')} ${fmt(monday)} au ${fmt(friday)}`
  }

  // Jour actif sélectionné sur mobile
  const currentDayIdx = (new Date().getDay() + 6) % 7
  const [selectedDay, setSelectedDay] = useState(currentDayIdx >= 0 && currentDayIdx <= 4 ? currentDayIdx : 0)

  if (!user || loading) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600 }}>{tcommon('status.loading')}</div>
      </div>
    )
  }

  if (!classId) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--red)', fontSize: 13, fontWeight: 700 }}>{t('timetable.no_class')}</div>
      </div>
    )
  }

  if (error === 'OFFLINE_NO_CACHE') return <OfflineEmptyState />

  if (error) {
    return (
      <div style={{ padding: '28px 32px', height: '100%', overflowY: 'auto' }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ color: 'var(--red)', fontSize: 13, fontWeight: 700, marginBottom: 12 }}>{error}</div>
          <button onClick={refetch}
            style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 800, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }}>
            {t('common.retry')}
          </button>
        </div>
      </div>
    )
  }

  const slots = data?.slots ?? {}
  const className = data?.className ?? ''
  const squelette = data?.squelette ?? DEFAULT_SKELETON
  const joursActifs = data?.joursActifs ?? ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']
  const squeletteParJour = data?.squeletteParJour ?? {}

  const activeDayName = DAY_NAMES[selectedDay] || 'LUNDI'
  const activeDayPeriods = squeletteParJour[activeDayName] || squelette

  return (
    <div className="px-3.5 py-3.5 sm:px-6 sm:py-5 space-y-3 sm:space-y-4" style={{ height: '100%', overflowY: 'auto' }}>
      <div style={{ marginBottom: fromCache ? 6 : 12 }}>
        <div style={sTitle}>{t('timetable.title')}</div>
        <div style={sSub}>{className} · {getWeekRange()}</div>
      </div>

      {fromCache && <CacheBadge cachedAt={cachedAt} />}

      {/* ========================================================
          VUE MOBILE (md:hidden) : Sélecteur de jour + Déroulé chronologique avec Pauses
         ======================================================== */}
      <div className="md:hidden space-y-3">
        {/* Pilules des jours de la semaine */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {joursActifs.map((j) => {
            const di = DAY_MAP[j] ?? 0
            const isSelected = selectedDay === di
            const isToday = currentDayIdx === di
            return (
              <button
                key={j}
                type="button"
                onClick={() => setSelectedDay(di)}
                className={`flex-1 min-w-[70px] py-2 px-2 rounded-xl text-xs font-bold transition-all border text-center cursor-pointer ${
                  isSelected
                    ? 'text-white shadow-xs'
                    : 'text-[var(--text2)] border-[var(--border)] hover:bg-[var(--bg2)]'
                }`}
                style={{
                  background: isSelected ? 'var(--primary)' : 'var(--surface)',
                  borderColor: isSelected ? 'var(--primary)' : 'var(--border)',
                }}
              >
                <div>{j.slice(0, 3)}</div>
                {isToday && (
                  <div className="text-[9px] font-extrabold mt-0.5 opacity-90 uppercase tracking-wider">
                    Auj.
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Déroulé chronologique du jour sélectionné */}
        <div className="space-y-2.5">
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

            if (visibleCell.length === 0) {
              return (
                <div
                  key={`cours-${pIdx}`}
                  className="rounded-xl border p-3 flex gap-3 items-center bg-[var(--surface)] border-[var(--border)] opacity-60"
                >
                  <div className="text-center shrink-0 pr-3 border-r border-[var(--border)] w-14">
                    <div className="text-xs font-bold text-[var(--text2)]">{periode.debut}</div>
                    <div className="text-[10px] text-[var(--text3)] mt-0.5">{periode.fin}</div>
                  </div>
                  <div className="text-xs font-medium text-[var(--text3)] italic">
                    Aucun cours programmé
                  </div>
                </div>
              )
            }

            return (
              <div key={`cours-${pIdx}`} className="space-y-1.5">
                {visibleCell.map((slot, sIdx) => {
                  const isFree = slot.kind === 'FREE'
                  return (
                    <div
                      key={sIdx}
                      className="rounded-xl border p-3 flex gap-3 items-center shadow-xs"
                      style={{
                        background: 'var(--surface)',
                        borderColor: 'var(--border)',
                        borderLeftWidth: 4,
                        borderLeftColor: isFree ? 'var(--blue)' : slot.color,
                      }}
                    >
                      {/* Horaires exacts de la période */}
                      <div className="text-center shrink-0 pr-3 border-r border-[var(--border)] w-14">
                        <div className="text-xs font-black text-[var(--text)]">{periode.debut}</div>
                        <div className="text-[10px] font-semibold text-[var(--text3)] mt-0.5">{periode.fin}</div>
                      </div>

                      {/* Détails du cours */}
                      <div className="min-w-0 flex-1">
                        {isFree ? (
                          <div className="text-xs font-bold text-[var(--blue)]">
                            {t('timetable.freeTime')}
                          </div>
                        ) : (
                          <>
                            <div className="text-xs sm:text-sm font-extrabold truncate" style={{ color: slot.color }}>
                              {slot.subject}
                            </div>
                            {slot.teacher && (
                              <div className="text-[11px] font-medium text-[var(--text3)] truncate mt-0.5 flex items-center gap-1">
                                <UserIcon size={12} className="shrink-0" />
                                <span>{slot.teacher}</span>
                              </div>
                            )}
                            {slot.room && (
                              <div className="text-[10px] font-bold text-[var(--text2)] mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-[var(--bg2)]">
                                <MapPin size={10} className="shrink-0" />
                                <span>{slot.room}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* ========================================================
          VUE DESKTOP (hidden md:block) : Tableau complet hebdomadaire avec Pauses
         ======================================================== */}
      <div className="hidden md:block rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden shadow-xs">
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
            <thead>
              <tr>
                <th style={{ ...thSt, width: 95 }}>{t('timetable.time_header')}</th>
                {joursActifs.map(j => (
                  <th key={j} style={thSt}>{j}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {squelette.map((periode, pIdx) => {
                // Ligne de Petite Pause
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

                // Ligne de Grande Pause
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

                // Ligne de cours normale
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
                        <td
                          key={jour}
                          style={{
                            padding: 0,
                            border: '1px solid var(--border)',
                            verticalAlign: 'top',
                            minWidth: 110,
                            height: 60,
                            opacity: courseActive ? 1 : 0.35,
                          }}
                        >
                          {!courseActive ? (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 13 }}>—</div>
                          ) : visibleCell.length > 0 ? (
                            <div style={{ height: '100%', padding: 2 }}>
                              {visibleCell.map((slot, index) => (
                                <div
                                  key={`${slot.groupId ?? 'class'}-${slot.subject}-${index}`}
                                  style={{
                                    padding: '5px 7px',
                                    background: slot.kind === 'FREE' ? 'var(--blue-light)' : `${slot.color}15`,
                                    borderLeft: `3px solid ${slot.kind === 'FREE' ? 'var(--blue)' : slot.color}`,
                                    marginBottom: index < visibleCell.length - 1 ? 2 : 0,
                                    borderRadius: 4,
                                  }}
                                >
                                  {slot.kind === 'FREE' ? (
                                    <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--blue)' }}>{t('timetable.freeTime')}</div>
                                  ) : (
                                    <>
                                      <div style={{ fontSize: 12, fontWeight: 800, color: slot.color }} className="truncate">
                                        {slot.subject}
                                      </div>
                                      {slot.teacher && (
                                        <div style={{ fontSize: 10.5, color: 'var(--text3)', marginTop: 1 }} className="truncate">
                                          {slot.teacher}
                                        </div>
                                      )}
                                      {slot.room && (
                                        <div style={{ fontSize: 9.5, color: 'var(--text2)', marginTop: 1 }} className="truncate font-semibold">
                                          {t('timetable.roomLabel')} {slot.room}
                                        </div>
                                      )}
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
