'use client'
import { Coffee, UtensilsCrossed } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { groupTimetableSlotsForDisplay, timetableCellKey } from '@/lib/timetableSlotGrouping'
import {
  DAY_MAP,
  DAY_NAME,
  type PeriodeGrille,
  type TimetableSlot,
  subjectColor,
} from '@/features/timetable/timetableShared'
import { thSt } from './timetableStaffTypes'

interface Props {
  slots: TimetableSlot[]
  squelette: PeriodeGrille[]
  squeletteParJour: Record<string, PeriodeGrille[]>
  joursActifs: string[]
  remplis: number
  totalCours: number
  pct: number
  onOpenModal: (slot: TimetableSlot) => void
  onOpenEmptyModal: (slot: TimetableSlot) => void
}

export default function TimetableGridTable({
  slots,
  squelette,
  squeletteParJour,
  joursActifs,
  remplis,
  totalCours,
  pct,
  onOpenModal,
  onOpenEmptyModal,
}: Props) {
  const t = useT('staff')
  const slotMap = groupTimetableSlotsForDisplay(slots)

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)', padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
          {t('timetable.slotsFilled', { filled: remplis, total: totalCours })}
        </span>
        <div style={{ flex: 1, background: 'var(--border)', borderRadius: 3, height: 5, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct === 100 ? 'var(--green)' : 'var(--amber)', transition: 'width 0.3s', borderRadius: 3 }} />
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: pct === 100 ? 'var(--green)' : 'var(--amber)' }}>{pct}%</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead>
            <tr>
              <th style={{ ...thSt, width: 85 }}>{t('timetable.scheduleHeader')}</th>
              {joursActifs.map(j => <th key={j} style={thSt}>{DAY_NAME[j] ?? j}</th>)}
            </tr>
          </thead>
          <tbody>
            {squelette.map((periode, idx) => {
              if (periode.type !== 'COURS') {
                const isPetite = periode.type === 'PETITE_PAUSE'
                return (
                  <tr key={`pause-${idx}`}>
                    <td style={{ padding: '3px 8px', background: 'var(--bg)', fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                      {periode.debut}<br /><span style={{ fontSize: 10, fontWeight: 600 }}>{periode.fin}</span>
                    </td>
                    {joursActifs.map(jour => {
                      const pauseActive = (squeletteParJour[jour] ?? squelette).some(periodeJour => periodeJour.type === periode.type && periodeJour.debut === periode.debut && periodeJour.fin === periode.fin)
                      return (
                        <td key={jour} style={{ padding: '3px 10px', background: pauseActive ? 'var(--amber-light)' : 'var(--bg)', border: '1px solid var(--border)', textAlign: 'center', fontSize: 11, fontWeight: 700, color: pauseActive ? 'var(--amber)' : 'var(--text3)' }}>
                          {pauseActive && <>{isPetite ? <Coffee size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} /> : <UtensilsCrossed size={12} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 3 }} />}{isPetite ? t('timetable.smallBreak') : t('timetable.bigBreak')}</>}
                        </td>
                      )
                    })}
                  </tr>
                )
              }

              return (
                <tr key={`cours-${periode.debut}`}>
                  <td style={{ padding: '6px 8px', background: 'var(--bg)', fontSize: 11.5, fontWeight: 800, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {periode.debut}<br /><span style={{ fontSize: 10, fontWeight: 600 }}>{periode.fin}</span>
                  </td>
                  {joursActifs.map(jour => {
                    const dayNum = DAY_MAP[jour]
                    const cellSlots = slotMap.get(timetableCellKey({ dayOfWeek: dayNum, startTime: periode.debut, endTime: periode.fin })) ?? []
                    const courseActive = (squeletteParJour[jour] ?? squelette).some(periodeJour => periodeJour.type === 'COURS' && periodeJour.debut === periode.debut && periodeJour.fin === periode.fin)

                    return (
                      <td
                        key={jour}
                        style={{ padding: 0, border: '1px solid var(--border)', verticalAlign: 'top', minWidth: 105, minHeight: 58, opacity: courseActive ? 1 : 0.4 }}
                        onClick={courseActive && cellSlots.length === 0 ? () => onOpenEmptyModal({ id: '', dayOfWeek: dayNum, startTime: periode.debut, endTime: periode.fin, room: null, kind: 'CLASS', subject: null, teacher: null, isLV2Slot: false }) : undefined}
                      >
                        {!courseActive ? (
                          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>—</div>
                        ) : cellSlots.length === 0 ? (
                          <div className="tt-cell-hover" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
                            <span style={{ fontSize: 16, color: 'var(--border2)' }}>+</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: 3, minHeight: 58, boxSizing: 'border-box' }}>
                            {cellSlots.map(slot => {
                              const col = slot.subject ? subjectColor(slot.subject.id) : null
                              return (
                                <div
                                  key={slot.id}
                                  className="tt-cell-filled"
                                  onClick={event => { event.stopPropagation(); onOpenModal(slot) }}
                                  style={{ padding: '4px 6px', background: slot.kind === 'FREE' ? 'var(--blue-light)' : col?.bg ?? 'var(--bg)', borderLeft: `3px solid ${slot.kind === 'FREE' ? 'var(--blue)' : col?.border ?? 'var(--border)'}`, boxSizing: 'border-box', cursor: 'pointer', ...(slot.kind === 'FREE' ? { display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, width: '100%', minHeight: '58px' } : {}) }}
                                >
                                  {slot.kind === 'FREE' ? (
                                    <div style={{ fontSize: 11.5, fontWeight: 800, color: 'var(--blue)' }}>{t('timetable.freeTime')}</div>
                                  ) : (
                                    <>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 800, color: col!.text }}>{slot.subject!.name}</span>
                                        {slot.isLV2Slot && <span title={t('timetable.lv2Tooltip')} style={{ background: 'rgba(3,105,161,0.14)', color: 'var(--blue)', fontSize: 8.5, fontWeight: 900, padding: '1px 3px', borderRadius: 4, whiteSpace: 'nowrap' }}>LV2 · {slot.subject!.name}</span>}
                                      </div>
                                      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot.teacher ? `${slot.teacher.firstName} ${slot.teacher.lastName}` : <span style={{ color: 'var(--amber)' }}>{t('timetable.noTeacher')}</span>}</div>
                                      {slot.room && <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t('timetable.roomLabel')} {slot.room}</div>}
                                    </>
                                  )}
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
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
