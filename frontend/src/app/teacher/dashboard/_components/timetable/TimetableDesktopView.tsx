'use client'
import { Coffee, Utensils, User as UserIcon } from 'lucide-react'
import { normalizeTimetableCellSlots } from '@/lib/timetableSlotGrouping'
import { DAY_MAP, getDayLabel, thSt, type CellSlots, type PeriodeGrille, type TranslateFn } from './types'

interface Props {
  joursActifs: string[]
  squelette: PeriodeGrille[]
  slots: Record<string, CellSlots>
  selectedView: string
  onSlotToast: (msg: string) => void
  t: TranslateFn
}

export default function TimetableDesktopView({
  joursActifs,
  squelette,
  slots,
  selectedView,
  onSlotToast,
  t,
}: Props) {
  return (
    <div className="hidden md:block" style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 680 }}>
          <thead>
            <tr>
              <th style={{ ...thSt, width: 85 }}>{t('timetable.header_schedule')}</th>
              {joursActifs.map(dayName => (
                <th key={dayName} style={thSt}>
                  {getDayLabel(dayName, t)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {squelette.map((periode, pIdx) => {
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

              return (
                <tr key={`desktop-row-${pIdx}-${periode.debut}`}>
                  <td style={{ padding: '6px 8px', background: 'var(--bg2)', fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', textAlign: 'center', border: '1px solid var(--border)', whiteSpace: 'nowrap' }}>
                    {periode.debut}<br /><span style={{ fontSize: 10, color: 'var(--text3)' }}>{periode.fin}</span>
                  </td>

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
                                  onClick={() => onSlotToast(`${slot.subject} — ${slot.classe}`)}
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
  )
}
