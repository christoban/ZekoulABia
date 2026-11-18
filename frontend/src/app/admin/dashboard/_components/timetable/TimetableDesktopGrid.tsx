'use client'

import { useT } from '@/lib/i18n'
import { normalizeTimetableCellSlots, timetableCellKey } from '@/lib/timetableSlotGrouping'
import { DAY_MAP, subjectColor, type PeriodeGrille, type TimetableSlot } from '@/features/timetable/timetableShared'
import { freeSlotStyle, thSt } from './timetableStyles'

interface TimetableDesktopGridProps {
  hasGridConfig: boolean
  joursActifs: string[]
  squelette: PeriodeGrille[]
  squeletteParJour: Record<string, PeriodeGrille[]>
  fallbackTimes: string[]
  slots: TimetableSlot[]
  slotMap: Map<string, TimetableSlot[]>
}

export default function TimetableDesktopGrid({
  hasGridConfig,
  joursActifs,
  squelette,
  squeletteParJour,
  fallbackTimes,
  slots,
  slotMap,
}: TimetableDesktopGridProps) {
  const t = useT('admin')

  return (
    <div className="hidden md:block overflow-x-auto">
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{ ...thSt, width: 95 }}>{t('timetable.schedule')}</th>
            {(hasGridConfig ? joursActifs : ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']).map(j => (
              <th key={j} style={thSt}>{t(`timetable.days.${j}`)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hasGridConfig ? (
            squelette.map((periode, idx) => {
              if (periode.type !== 'COURS') {
                const isPetite = periode.type === 'PETITE_PAUSE'
                return (
                  <tr key={`pause-${idx}`}>
                    <td colSpan={joursActifs.length + 1}
                      style={{ textAlign: 'center', padding: '5px 12px', background: 'var(--amber-light)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontSize: 11.5, fontWeight: 700, color: 'var(--amber)' }}>
                      {isPetite ? t('timetable.smallBreak') : t('timetable.bigBreak')} — {periode.debut} {t('timetable.to')} {periode.fin}
                    </td>
                  </tr>
                )
              }
              return (
                <tr key={`cours-${periode.debut}`}>
                  <td style={{ padding: '7px 9px', background: 'var(--bg)', fontSize: 12, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {periode.debut}<br /><span style={{ fontSize: 10.5 }}>{periode.fin}</span>
                  </td>
                  {joursActifs.map(jour => {
                    const dayNum = DAY_MAP[jour]
                    const cellSlots = slotMap.get(timetableCellKey({ dayOfWeek: dayNum, startTime: periode.debut, endTime: periode.fin })) ?? []
                    const courseActive = (squeletteParJour[jour] ?? squelette).some(periodeJour => periodeJour.type === 'COURS' && periodeJour.debut === periode.debut && periodeJour.fin === periode.fin)

                    return (
                      <td key={jour} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 105, minHeight: 60, opacity: courseActive ? 1 : 0.4 }}>
                        {!courseActive ? (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>—</div>
                        ) : cellSlots.length === 0 ? (
                          <div style={{ height: '100%', background: 'var(--bg)' }} />
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 3, minHeight: 60, boxSizing: 'border-box' }}>
                            {cellSlots.map(slot => {
                              const col = slot.subject ? subjectColor(slot.subject.id) : null
                              return (
                                <div key={slot.id} style={{ padding: '5px 7px', background: slot.kind === 'FREE' ? 'var(--blue-light)' : col?.bg, borderLeft: `3px solid ${slot.kind === 'FREE' ? 'var(--blue)' : col?.border}`, boxSizing: 'border-box', ...(slot.kind === 'FREE' ? freeSlotStyle : {}) }}>
                                  {slot.kind === 'FREE' ? <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--blue)' }}>{t('timetable.freeTime')}</div> : <>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}><span style={{ fontSize: 11.5, fontWeight: 800, color: col?.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{slot.subject?.name}</span>{slot.isLV2Slot && <span style={{ fontSize: 8.5, fontWeight: 900, color: 'var(--blue)', background: 'rgba(3,105,161,0.14)', padding: '1px 3px', borderRadius: 4, whiteSpace: 'nowrap' }}>LV2 · {slot.subject?.name}</span>}</div>
                                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : <span style={{ color: 'var(--amber)' }}>{t('timetable.noTeacher')}</span>}</div>
                                    {slot.room && <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('timetable.roomLabel')} {slot.room}</div>}
                                  </>}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>
                    )
                  })}
                </tr>
              )
            })
          ) : (
            fallbackTimes.map(time => (
              <tr key={time}>
                <td style={{ padding: '7px 9px', background: 'var(--bg)', fontSize: 12, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                  {time}
                </td>
                {[1, 2, 3, 4, 5].map(d => {
                  const cellSlots = normalizeTimetableCellSlots(slots.filter(slot => slot.dayOfWeek === d && slot.startTime === time))
                  return (
                    <td key={d} style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 105, minHeight: 60 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 3, boxSizing: 'border-box' }}>
                        {cellSlots.map(slot => {
                          const col = slot.subject ? subjectColor(slot.subject.id) : null
                          return <div key={slot.id} style={{ padding: '5px 7px', background: slot.kind === 'FREE' ? 'var(--bg2)' : col?.bg, borderLeft: `3px solid ${slot.kind === 'FREE' ? 'var(--border)' : col?.border}`, boxSizing: 'border-box', ...(slot.kind === 'FREE' ? freeSlotStyle : {}) }}>
                            <div style={{ fontSize: 11.5, fontWeight: 800, color: col?.text }}>{slot.kind === 'FREE' ? t('timetable.freeTime') : slot.subject?.name}</div>
                            {slot.subject && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : '—'}</div>}
                            {slot.room && <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>{t('timetable.roomLabel')} {slot.room}</div>}
                          </div>
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
