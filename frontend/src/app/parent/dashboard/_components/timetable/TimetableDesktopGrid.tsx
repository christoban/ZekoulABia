'use client'

import { Coffee, Utensils } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { normalizeTimetableCellSlots } from '@/lib/timetableSlotGrouping'
import type { CellSlots, PeriodeGrille } from './types'
import { DAY_MAP } from './timetableHelpers'

interface Props {
  joursActifs: string[]
  squelette: PeriodeGrille[]
  squeletteParJour: Record<string, PeriodeGrille[]>
  slots: Record<string, CellSlots>
}

export default function TimetableDesktopGrid({
  joursActifs,
  squelette,
  squeletteParJour,
  slots,
}: Props) {
  const t = useT('parent')

  return (
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
                      (pj) => pj.type === 'COURS' && pj.debut === periode.debut && pj.fin === periode.fin
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
  )
}

const thSt: React.CSSProperties = {
  padding: '7px 8px',
  textAlign: 'center',
  fontSize: 11,
  fontWeight: 800,
  color: 'var(--text3)',
  background: 'var(--bg2)',
  border: '1px solid var(--border)',
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
}
