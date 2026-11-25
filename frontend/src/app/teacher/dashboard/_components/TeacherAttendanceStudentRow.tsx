'use client'

import { Check, X, AlarmClock } from 'lucide-react'
import type { LateEntryDetail, TeacherAttendanceStudent, TeacherAttStatus } from './teacherAttendanceTypes'

interface Props {
  student: TeacherAttendanceStudent
  index: number
  status: TeacherAttStatus
  lateInfo?: LateEntryDetail
  isJustified: boolean
  showClassName: boolean
  onStatusChange: (studentId: string, nextStatus: TeacherAttStatus) => void
  onLateFieldChange: (studentId: string, patch: Partial<LateEntryDetail>) => void
}

export default function TeacherAttendanceStudentRow({
  student,
  index,
  status,
  lateInfo,
  isJustified,
  showClassName,
  onStatusChange,
  onLateFieldChange,
}: Props) {
  const isLate = status === 'LATE'

  return (
    <div className="p-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-6 h-6 rounded-md bg-[var(--bg2)] text-[11px] font-bold text-[var(--text3)] flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          <span className="text-[13px] font-bold text-[var(--text)] truncate">{student.name}</span>
          {showClassName && student.className && (
            <span className="text-[11px] text-[var(--text3)]">({student.className})</span>
          )}
          {isJustified && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--blue-light)] text-[var(--blue)]">
              Justifié
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onStatusChange(student.id, 'PRESENT')}
            className="h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            style={{
              border: `1.5px solid ${status === 'PRESENT' ? 'var(--green)' : 'var(--border2)'}`,
              background: status === 'PRESENT' ? 'var(--green-light)' : 'var(--bg)',
              color: status === 'PRESENT' ? 'var(--green)' : 'var(--text3)',
            }}
          >
            <Check size={13} strokeWidth={2.5} /> Présent
          </button>
          <button
            type="button"
            onClick={() => onStatusChange(student.id, 'ABSENT')}
            className="h-8 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            style={{
              border: `1.5px solid ${status === 'ABSENT' ? 'var(--red)' : 'var(--border2)'}`,
              background: status === 'ABSENT' ? 'var(--red-light)' : 'var(--bg)',
              color: status === 'ABSENT' ? 'var(--red)' : 'var(--text3)',
            }}
          >
            <X size={13} strokeWidth={2.5} /> Absent
          </button>
          <button
            type="button"
            onClick={() => onStatusChange(student.id, isLate ? 'PRESENT' : 'LATE')}
            className="h-8 px-2.5 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer"
            style={{
              border: `1.5px solid ${isLate ? 'var(--amber)' : 'var(--border2)'}`,
              background: isLate ? 'var(--amber-light)' : 'var(--bg)',
              color: isLate ? 'var(--amber)' : 'var(--text2)',
            }}
          >
            <AlarmClock size={13} /> Retard ?
          </button>
        </div>
      </div>

      {isLate && lateInfo && (
        <div className="flex flex-col sm:flex-row gap-2 pt-1.5 border-t border-[var(--border)]">
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text2)]">
            <span>Arrivé à :</span>
            <input
              type="time"
              value={lateInfo.arrivedTime}
              onChange={(e) => onLateFieldChange(student.id, { arrivedTime: e.target.value })}
              className="h-8 px-2 rounded-md border border-[var(--border2)] bg-[var(--bg)] text-xs font-bold text-[var(--text)]"
            />
          </label>
          <input
            type="text"
            placeholder="Note de retard (optionnelle)"
            value={lateInfo.lateNote}
            onChange={(e) => onLateFieldChange(student.id, { lateNote: e.target.value })}
            className="flex-1 h-8 px-2.5 rounded-md border border-[var(--border2)] bg-[var(--bg)] text-xs text-[var(--text)]"
          />
        </div>
      )}
    </div>
  )
}

