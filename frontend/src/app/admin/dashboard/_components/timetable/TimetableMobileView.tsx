'use client'

import { motion } from 'framer-motion'
import { useT } from '@/lib/i18n'
import { normalizeTimetableCellSlots, timetableCellKey } from '@/lib/timetableSlotGrouping'
import { DAY_MAP, subjectColor, type PeriodeGrille, type TimetableSlot } from '@/features/timetable/timetableShared'
import { freeSlotStyle } from './timetableStyles'

interface TimetableMobileViewProps {
  displayDays: string[]
  effectiveMobileDay: string
  onSelectMobileDay: (day: string) => void
  hasGridConfig: boolean
  squelette: PeriodeGrille[]
  squeletteParJour: Record<string, PeriodeGrille[]>
  fallbackTimes: string[]
  slots: TimetableSlot[]
  slotMap: Map<string, TimetableSlot[]>
}

export default function TimetableMobileView({
  displayDays,
  effectiveMobileDay,
  onSelectMobileDay,
  hasGridConfig,
  squelette,
  squeletteParJour,
  fallbackTimes,
  slots,
  slotMap,
}: TimetableMobileViewProps) {
  const t = useT('admin')

  return (
    <div className="md:hidden">
      <div className="relative -mr-4 border-b border-[var(--border)]">
        <div className="flex gap-1.5 overflow-x-auto p-2 scrollbar-none">
          {displayDays.map(j => {
            const active = effectiveMobileDay === j
            return (
              <button key={j} onClick={() => onSelectMobileDay(j)}
                className="relative flex-shrink-0 rounded-full px-3.5 py-1.5 whitespace-nowrap border-0 cursor-pointer font-inherit">
                {active && (
                  <motion.div layoutId="timetable-day-pill" className="absolute inset-0 rounded-full"
                    style={{ background: 'var(--sidebar)' }}
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                )}
                <span className="relative z-10 text-xs font-bold" style={{ color: active ? '#fff' : 'var(--text3)' }}>
                  {t(`timetable.days.${j}`)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="p-3 flex flex-col gap-2.5">
        {hasGridConfig ? squelette.map((periode, idx) => {
          if (periode.type !== 'COURS') {
            const isPetite = periode.type === 'PETITE_PAUSE'
            return (
              <div key={`m-pause-${idx}`} className="rounded-lg shadow-xs flex items-stretch overflow-hidden">
                <div className="w-14 flex-shrink-0 p-2.5 bg-[var(--bg2)] text-[10.5px] font-bold text-[var(--text3)] text-center">
                  {periode.debut}<br /><span className="text-[9.5px]">{periode.fin}</span>
                </div>
                <div className="flex-1 p-2.5 bg-[var(--amber-light)] border-l-2 border-[var(--amber)] flex items-center">
                  <span className="text-xs font-bold text-[var(--amber)]">{isPetite ? t('timetable.smallBreak') : t('timetable.bigBreak')}</span>
                </div>
              </div>
            )
          }
          const cellSlots = slotMap.get(timetableCellKey({ dayOfWeek: DAY_MAP[effectiveMobileDay]!, startTime: periode.debut, endTime: periode.fin })) ?? []
          const courseActive = (squeletteParJour[effectiveMobileDay] ?? squelette).some(periodeJour => periodeJour.type === 'COURS' && periodeJour.debut === periode.debut && periodeJour.fin === periode.fin)

          return (
            <div key={`m-cours-${periode.debut}`} className="rounded-lg shadow-xs flex items-stretch overflow-hidden">
              <div className="w-14 flex-shrink-0 p-2.5 bg-[var(--bg2)] text-[10.5px] font-bold text-[var(--text3)] text-center">
                {periode.debut}<br /><span className="text-[9.5px]">{periode.fin}</span>
              </div>
              <div className="flex-1 p-2.5" style={{ background: 'var(--surface)', opacity: courseActive ? 1 : 0.4 }}>
                {!courseActive ? <div className="text-xs text-[var(--text3)]">—</div> : <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{cellSlots.map(slot => {
                  const col = slot.subject ? subjectColor(slot.subject.id) : null
                  return <div key={slot.id} style={{ padding: '5px 6px', background: slot.kind === 'FREE' ? 'var(--blue-light)' : col?.bg, borderLeft: `3px solid ${slot.kind === 'FREE' ? 'var(--blue)' : col?.border}`, ...(slot.kind === 'FREE' ? freeSlotStyle : {}) }}>
                    <div className="text-xs font-bold" style={{ color: slot.kind === 'FREE' ? 'var(--blue)' : col?.text }}>{slot.kind === 'FREE' ? t('timetable.freeTime') : slot.subject?.name}</div>
                    {slot.subject && <div className="text-[11px] text-[var(--text3)] mt-0.5">{slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : '—'}</div>}
                    {slot.room && <div className="text-[10.5px] text-[var(--text3)] mt-0.5">{t('timetable.roomLabel')} {slot.room}</div>}
                  </div>
                })}</div>}
              </div>
            </div>
          )
        }) : fallbackTimes.map(time => {
          const d = DAY_MAP[effectiveMobileDay]
          const cellSlots = normalizeTimetableCellSlots(slots.filter(slot => slot.dayOfWeek === d && slot.startTime === time))
          return (
            <div key={`m-${time}`} className="rounded-lg shadow-xs flex items-stretch overflow-hidden">
              <div className="w-14 flex-shrink-0 p-2.5 bg-[var(--bg2)] text-[10.5px] font-bold text-[var(--text3)] text-center">{time}</div>
              <div className="flex-1 p-2.5" style={{ background: 'var(--surface)' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{cellSlots.map(slot => {
                  const col = slot.subject ? subjectColor(slot.subject.id) : null
                  return <div key={slot.id} style={{ padding: '5px 6px', background: slot.kind === 'FREE' ? 'var(--blue-light)' : col?.bg, borderLeft: `3px solid ${slot.kind === 'FREE' ? 'var(--blue)' : col?.border}`, ...(slot.kind === 'FREE' ? freeSlotStyle : {}) }}>
                    <div className="text-xs font-bold" style={{ color: slot.kind === 'FREE' ? 'var(--blue)' : col?.text }}>{slot.kind === 'FREE' ? t('timetable.freeTime') : slot.subject?.name}</div>
                    {slot.subject && <div className="text-[11px] text-[var(--text3)] mt-0.5">{slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : '—'}</div>}
                    {slot.room && <div className="text-[10.5px] text-[var(--text3)] mt-0.5">{t('timetable.roomLabel')} {slot.room}</div>}
                  </div>
                })}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
