'use client'
import { Coffee, Utensils } from 'lucide-react'
import { normalizeTimetableCellSlots } from '@/lib/timetableSlotGrouping'
import { DAY_MAP, getDayLabel, type CellSlots, type PeriodeGrille, type TranslateFn } from './types'

interface Props {
  joursActifs: string[]
  selectedDay: number
  activeDayName: string
  squeletteDuJour: PeriodeGrille[]
  slots: Record<string, CellSlots>
  selectedView: string
  onSelectDay: (idx: number) => void
  onSlotToast: (msg: string) => void
  t: TranslateFn
}

export default function TimetableMobileView({
  joursActifs,
  selectedDay,
  activeDayName,
  squeletteDuJour,
  slots,
  selectedView,
  onSelectDay,
  onSlotToast,
  t,
}: Props) {
  return (
    <div className="md:hidden space-y-3">
      {/* Pilules des jours */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {joursActifs.map((dayName, di) => {
          const isSelected = selectedDay === di
          return (
            <button
              key={dayName}
              onClick={() => onSelectDay(di)}
              className="flex-1 min-w-[58px] h-10 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center cursor-pointer"
              style={{
                background: isSelected ? 'var(--primary)' : 'var(--surface)',
                color: isSelected ? 'white' : 'var(--text2)',
                border: `1.5px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}`,
                boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              <span>{getDayLabel(dayName, t).slice(0, 3)}</span>
            </button>
          )
        })}
      </div>

      {/* Timeline verticale avec cours et pauses */}
      <div className="space-y-2">
        {squeletteDuJour.map((periode, pIdx) => {
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
                          onClick={() => onSlotToast(`${slot.subject} — ${slot.classe}`)}
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
  )
}
