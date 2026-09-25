'use client'

import { useMemo } from 'react'
import { useT } from '@/lib/i18n'
import { groupTimetableSlots, timetableCellKey } from '@/lib/timetableSlotGrouping'
import { X } from 'lucide-react'

export interface ProposalPreviewSession {
  subjectId: string
  teacherId: string
  roomId: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface ProposalPreviewGroupSession extends ProposalPreviewSession {
  groupId: string
  groupName: string
  participantsCount: number
  isLV2Slot: true
}

export interface ProposalPreviewMissingHours {
  subjectId: string
  teacherName?: string
  nbHeures: number
  cause: string
}

export interface ProposalPreviewAssignment {
  subjectId: string
  subjectName: string
  currentTeacherName: string | null
}

interface PeriodeGrille {
  ordre: number
  debut: string
  fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'
  duree: number
}

interface Props {
  className: string
  seances: ProposalPreviewSession[]
  seancesGroupes?: ProposalPreviewGroupSession[]
  squelette: PeriodeGrille[]
  squeletteParJour: Record<string, PeriodeGrille[]>
  joursActifs: string[]
  assignments: ProposalPreviewAssignment[]
  status?: string
  warnings?: string[]
  degradeDetails?: string[]
  heuresNonPlacees?: ProposalPreviewMissingHours[]
  loading?: boolean
  onClose: () => void
}

const DAY_NAME: Record<string, string> = {
  LUNDI: 'Lundi', MARDI: 'Mardi', MERCREDI: 'Mercredi', JEUDI: 'Jeudi', VENDREDI: 'Vendredi', SAMEDI: 'Samedi',
}
const DAY_MAP: Record<string, number> = { LUNDI: 0, MARDI: 1, MERCREDI: 2, JEUDI: 3, VENDREDI: 4, SAMEDI: 5 }
const SUBJECT_PALETTES = [
  { bg: 'rgba(5,150,105,0.10)', border: 'var(--green)', text: 'var(--green2)' },
  { bg: 'rgba(37,99,235,0.09)', border: 'var(--blue)', text: 'var(--blue)' },
  { bg: 'rgba(217,119,6,0.09)', border: 'var(--amber)', text: 'var(--amber)' },
  { bg: 'rgba(139,92,246,0.09)', border: 'var(--purple)', text: 'var(--purple)' },
  { bg: 'rgba(236,72,153,0.09)', border: 'var(--red)', text: 'var(--red)' },
  { bg: 'rgba(142,42,58,0.09)', border: 'var(--primary)', text: 'var(--primary)' },
  { bg: 'rgba(239,68,68,0.09)', border: 'var(--red)', text: 'var(--red)' },
  { bg: 'rgba(251,146,60,0.09)', border: 'var(--orange)', text: 'var(--orange)' },
]

function subjectColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return SUBJECT_PALETTES[Math.abs(hash) % SUBJECT_PALETTES.length]
}

export default function TimetableProposalPreview({ className, seances, seancesGroupes = [], squelette, squeletteParJour, joursActifs, assignments, status, warnings = [], degradeDetails = [], heuresNonPlacees = [], loading = false, onClose }: Props) {
  const t = useT('staff')
  const assignmentBySubject = useMemo(() => new Map(assignments.map(assignment => [assignment.subjectId, assignment])), [assignments])
  const sessionsByCell = useMemo(() => groupTimetableSlots<ProposalPreviewSession | ProposalPreviewGroupSession>([...seances, ...seancesGroupes]), [seances, seancesGroupes])
  const cellStyle = { padding: 0, border: '1px solid var(--border)', verticalAlign: 'top' as const, minWidth: 125, height: 62 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000, padding: 16 }} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, width: '100%', maxWidth: 1120, maxHeight: '92vh', overflow: 'auto', boxShadow: '0 18px 50px rgba(0,0,0,0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-spectral,Spectral,serif)', fontSize: 19, fontWeight: 700, color: 'var(--text)' }}>{t('timetable.bulkPreviewTitle', { className })}</div>
            <div style={{ marginTop: 5, display: 'inline-flex', padding: '4px 8px', borderRadius: 6, background: 'var(--amber-light)', color: 'var(--amber)', fontSize: 11.5, fontWeight: 700 }}>{t('timetable.bulkPreviewNotApplied')}</div>
          </div>
          <button type="button" onClick={onClose} aria-label={t('timetable.bulkPreviewClose')} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 3 }}><X size={19} /></button>
        </div>
        {(status === 'PARTIEL' || status === 'DEGRADE' || warnings.length > 0) && (
          <div style={{ margin: '14px 20px 0', padding: '10px 12px', background: status === 'PARTIEL' || status === 'DEGRADE' ? 'var(--amber-light)' : 'var(--orange-light)', border: `1px solid ${status === 'PARTIEL' || status === 'DEGRADE' ? 'var(--amber)' : 'var(--orange)'}`, borderRadius: 8, color: status === 'PARTIEL' || status === 'DEGRADE' ? 'var(--amber)' : 'var(--orange)', fontSize: 12 }}>
            <div style={{ fontWeight: 800 }}>{status === 'PARTIEL' ? t('timetable.bulkPartialDetails') : status === 'DEGRADE' ? t('timetable.bulkDegradedDetails') : t('timetable.bulkWarnings')}</div>
            {status === 'DEGRADE' && degradeDetails.map(detail => <div key={detail} style={{ marginTop: 4 }}>{detail}</div>)}
            {heuresNonPlacees.map(heures => <div key={`${heures.subjectId}-${heures.cause}`} style={{ marginTop: 4 }}>{t('timetable.bulkPartialHours', { subjectId: assignmentBySubject.get(heures.subjectId)?.subjectName ?? heures.subjectId, hours: heures.nbHeures })} — {heures.cause}</div>)}
            {warnings.map(warning => <div key={warning} style={{ marginTop: 4 }}>{warning}</div>)}
          </div>
        )}
        <div style={{ padding: 16, overflowX: 'auto', filter: 'blur(0.25px)', opacity: 0.92 }}>
          {loading ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>{t('timetable.bulkPreviewLoading')}</div> : squelette.length === 0 ? <div style={{ padding: 30, textAlign: 'center', color: 'var(--text3)' }}>{t('timetable.bulkPreviewNoGrid')}</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
              <thead><tr><th style={{ padding: '8px', textAlign: 'left', color: 'var(--text3)', fontSize: 11 }}>{t('timetable.scheduleHeader')}</th>{joursActifs.map(day => <th key={day} style={{ padding: '8px', color: 'var(--text3)', fontSize: 11 }}>{DAY_NAME[day] ?? day}</th>)}</tr></thead>
              <tbody>
                {squelette.map((periode, index) => {
                  if (periode.type !== 'COURS') return null
                  return <tr key={`${periode.debut}-${index}`}>
                    <td style={{ padding: '7px 9px', background: 'var(--bg)', color: 'var(--text3)', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{periode.debut}<br />{periode.fin}</td>
                    {joursActifs.map(day => {
                      const dayNumber = DAY_MAP[day]
                      const dayPeriods = squeletteParJour[day] ?? squelette
                      const active = dayPeriods.some(item => item.type === 'COURS' && item.debut === periode.debut && item.fin === periode.fin)
                       const cellSessions = sessionsByCell.get(timetableCellKey({ dayOfWeek: dayNumber, startTime: periode.debut, endTime: periode.fin })) ?? []
                       return <td key={day} style={{ ...cellStyle, background: active ? 'var(--surface)' : 'var(--bg)', opacity: active ? 1 : 0.45 }}>
                         {active && cellSessions.length > 0 ? <div style={{ display: 'flex', flexDirection: 'column', gap: 3, margin: 4 }}>{cellSessions.map(session => {
                           const colors = subjectColor(session.subjectId)
                           const assignment = assignmentBySubject.get(session.subjectId)
                           const teacher = assignment?.currentTeacherName ?? session.teacherId
                           return <div key={`${'groupId' in session ? session.groupId : 'class'}-${session.subjectId}`} style={{ padding: '4px 6px', boxSizing: 'border-box', background: colors.bg, borderLeft: `3px solid ${colors.border}` }}>
                             <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}><span style={{ color: colors.text, fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{assignment?.subjectName ?? session.subjectId}</span>{('isLV2Slot' in session && session.isLV2Slot) && <span style={{ color: 'var(--blue)', background: 'rgba(3,105,161,0.14)', padding: '1px 3px', borderRadius: 4, fontSize: 8.5, fontWeight: 900, whiteSpace: 'nowrap' }}>LV2 · {assignment?.subjectName ?? session.subjectId}</span>}</div>
                             <div style={{ color: 'var(--text3)', fontSize: 10, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{teacher}</div>
                           </div>
                         })}</div> : active ? <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)' }}>—</div> : null}
                       </td>
                    })}
                  </tr>
                })}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
          <button type="button" onClick={onClose} style={{ background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('timetable.bulkPreviewClose')}</button>
        </div>
      </div>
    </div>
  )
}
