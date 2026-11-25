'use client'

import { Clock, MapPin, User as UserIcon, Coffee, Utensils } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { normalizeTimetableCellSlots } from '@/lib/timetableSlotGrouping'
import type { CellSlots, PeriodeGrille } from './types'
import { DAY_MAP } from './timetableHelpers'

interface Props {
  joursActifs: string[]
  selectedDay: number
  onSelectDay: (dayIdx: number) => void
  activeDayPeriods: PeriodeGrille[]
  slots: Record<string, CellSlots>
}

export default function TimetableMobileView({
  joursActifs,
  selectedDay,
  onSelectDay,
  activeDayPeriods,
  slots,
}: Props) {
  const t = useT('parent')

  return (
    <div className="md:hidden space-y-3">
      {/* Pilules des jours de la semaine */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
        {joursActifs.map((j) => {
          const di = DAY_MAP[j] ?? 0
          const isSelected = selectedDay === di
          return (
            <button
              key={j}
              onClick={() => onSelectDay(di)}
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
  )
}
