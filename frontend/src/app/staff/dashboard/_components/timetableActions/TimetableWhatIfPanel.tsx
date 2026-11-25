'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Play, X } from 'lucide-react'
import { useT } from '@/lib/i18n'
import {
  actionButton,
  DAY_NAMES,
  iconButton,
  inputStyle,
  type Assignment,
  type BusyAction,
  type Room,
  type SimulationResult,
} from './timetableActionsTypes'

interface Props {
  activeRooms: Room[]
  unavailableRooms: Set<string>
  toggleRoom: (id: string) => void
  teacherUnavailableId: string
  setTeacherUnavailableId: (v: string) => void
  assignedTeachers: Array<[string, string]>
  teacherDay: string
  setTeacherDay: (v: string) => void
  teacherStart: string
  setTeacherStart: (v: string) => void
  teacherEnd: string
  setTeacherEnd: (v: string) => void
  assignments: Assignment[]
  hoursToRemove: Record<string, number>
  setHoursToRemove: Dispatch<SetStateAction<Record<string, number>>>
  busy: BusyAction
  simulation: SimulationResult | null
  onSimulate: () => void
  onClose: () => void
}

export default function TimetableWhatIfPanel({
  activeRooms,
  unavailableRooms,
  toggleRoom,
  teacherUnavailableId,
  setTeacherUnavailableId,
  assignedTeachers,
  teacherDay,
  setTeacherDay,
  teacherStart,
  setTeacherStart,
  teacherEnd,
  setTeacherEnd,
  assignments,
  hoursToRemove,
  setHoursToRemove,
  busy,
  simulation,
  onSimulate,
  onClose,
}: Props) {
  const t = useT('staff')

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--blue)', borderRadius: 12, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <strong style={{ color: 'var(--text)', fontSize: 13 }}>{t('timetable.planning.whatIfTitle')}</strong>
        <button style={iconButton} onClick={onClose} aria-label={t('timetable.planning.close')}><X size={15} /></button>
      </div>
      <div style={{ color: 'var(--text3)', fontSize: 11.5, marginBottom: 9 }}>{t('timetable.planning.whatIfHint')}</div>
      <div style={{ display: 'grid', gap: 6, maxHeight: 130, overflowY: 'auto' }}>
        {activeRooms.map(room => (
          <label key={room.id} style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text2)', fontSize: 12 }}>
            <input type="checkbox" checked={unavailableRooms.has(room.id)} onChange={() => toggleRoom(room.id)} />
            {room.name} · {room.capacity}
          </label>
        ))}
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span style={{ color: 'var(--text2)', fontSize: 11.5 }}>{t('timetable.planning.teacherUnavailable')}</span>
          <select value={teacherUnavailableId} onChange={event => setTeacherUnavailableId(event.target.value)} style={inputStyle}>
            <option value="">{t('timetable.planning.teacherPlaceholder')}</option>
            {assignedTeachers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        {teacherUnavailableId && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <select value={teacherDay} onChange={event => setTeacherDay(event.target.value)} style={{ ...inputStyle, width: 130 }}>
              {DAY_NAMES.map((day, index) => <option key={day} value={index}>{day}</option>)}
            </select>
            <input type="time" value={teacherStart} onChange={event => setTeacherStart(event.target.value)} style={{ ...inputStyle, width: 120 }} />
            <input type="time" value={teacherEnd} onChange={event => setTeacherEnd(event.target.value)} style={{ ...inputStyle, width: 120 }} />
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gap: 6, marginTop: 10 }}>
        {assignments.map(assignment => (
          <label key={assignment.subjectId} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, color: 'var(--text2)', fontSize: 12 }}>
            <span>{assignment.subjectName}</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={hoursToRemove[assignment.subjectId] ?? 0}
              onChange={event => setHoursToRemove(previous => ({ ...previous, [assignment.subjectId]: Number(event.target.value) }))}
              style={{ width: 72, padding: 5, border: '1px solid var(--border)', borderRadius: 6 }}
            />
          </label>
        ))}
      </div>
      <button style={{ ...actionButton, marginTop: 12 }} onClick={onSimulate} disabled={busy !== null}>
        <Play size={14} /> {busy === 'whatif' ? t('timetable.planning.simulating') : t('timetable.planning.simulate')}
      </button>
      {simulation && (
        <div style={{ marginTop: 10, padding: 10, borderRadius: 8, background: 'var(--blue-light)', color: 'var(--text2)', fontSize: 12 }}>
          <strong style={{ color: 'var(--blue)' }}>{t('timetable.planning.simulationResult')}</strong>
          <div>{t('timetable.planning.moved', { count: simulation.differences.seancesDeplacees })}</div>
          <div>{t('timetable.planning.score', { base: simulation.differences.scoreBase, simulated: simulation.differences.scoreSimule })}</div>
        </div>
      )}
    </div>
  )
}
