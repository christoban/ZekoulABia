'use client'
import { WifiOff, Save, CheckCircle2, Upload, Loader2 } from 'lucide-react'
import {
  GRADE_STATUS_COLORS,
  getGradeStatusLabel,
  btnPrim,
  btnSec,
  thSt,
  tdSt,
  type TeacherGradeRow,
  type TranslateFn,
} from './types'

interface Props {
  grades: TeacherGradeRow[]
  notes: Record<string, number>
  observations: Record<string, string>
  rosterLabel: string | null
  saving: boolean
  isOnline: boolean
  draftCount: number
  rejectedCount: number
  modifiableCount: number
  onNoteChange: (sid: string, value: number) => void
  onObservationChange: (sid: string, value: string) => void
  onSaveDraft: () => void
  onSubmitGrades: () => void
  t: TranslateFn
}

export default function GradesEntryList({
  grades,
  notes,
  observations,
  rosterLabel,
  saving,
  isOnline,
  draftCount,
  rejectedCount,
  modifiableCount,
  onNoteChange,
  onObservationChange,
  onSaveDraft,
  onSubmitGrades,
  t,
}: Props) {
  return (
    <>
      {/* ── VUE MOBILE: Cartes de saisie des notes tactiles ── */}
      <div className="md:hidden divide-y divide-[var(--border)]">
        {grades.map((g, i: number) => {
          const sid = g.studentId || g.student?.id || ''
          const name = g.student ? `${g.student.firstName} ${g.student.lastName}` : t('grades_section.unknown_student')
          const status = g.validationStatus || 'DRAFT'
          const sc = GRADE_STATUS_COLORS[status] || GRADE_STATUS_COLORS.DRAFT
          const isEditable = status === 'DRAFT' || status === 'REJECTED'
          const currentScore = notes[sid] ?? 0

          return (
            <div key={sid} className="p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-6 h-6 rounded-md bg-[var(--bg2)] text-[11px] font-bold text-[var(--text3)] flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] font-bold text-[var(--text)] truncate">{name}</div>
                    {rosterLabel && g.student?.className && (
                      <div className="text-[11px] font-semibold text-[var(--text3)]">{g.student.className}</div>
                    )}
                  </div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10.5, fontWeight: 700, background: sc.bg, color: sc.color, whiteSpace: 'nowrap' }}>
                  {getGradeStatusLabel(status, t)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    min={0}
                    max={20}
                    step={0.25}
                    value={notes[sid] ?? 0}
                    onChange={e => onNoteChange(sid, Number(e.target.value))}
                    disabled={!isEditable}
                    className="h-11 w-20 rounded-lg text-center text-base font-black border"
                    style={{
                      borderColor: 'var(--border2)',
                      background: !isEditable ? 'var(--bg2)' : 'var(--surface)',
                      color: currentScore < 10 ? 'var(--red)' : currentScore >= 16 ? 'var(--green)' : 'var(--text)',
                      fontFamily: 'inherit',
                    }}
                  />
                  <span className="text-xs font-bold text-[var(--text3)]">/ 20</span>
                </div>

                <input
                  type="text"
                  value={observations[sid] || ''}
                  placeholder={t('grades_section.observation_placeholder')}
                  onChange={e => onObservationChange(sid, e.target.value)}
                  disabled={!isEditable}
                  className="h-11 flex-1 px-3 text-xs rounded-lg border outline-none min-w-0"
                  style={{
                    borderColor: 'var(--border2)',
                    background: !isEditable ? 'var(--bg2)' : 'var(--surface)',
                    color: 'var(--text)',
                    fontFamily: 'inherit',
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {/* ── VUE DESKTOP: Table complète conservée intacte ── */}
      <div className="hidden md:block" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <thead>
            <tr>{[t('grades_section.table_num'), t('grades_section.table_student'), t('grades_section.table_grade'), t('grades_section.table_observation'), t('grades_section.table_status')].map(h => (
              <th key={h} style={thSt}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {grades.map((g, i: number) => {
              const sid = g.studentId || g.student?.id || ''
              const name = g.student ? `${g.student.firstName} ${g.student.lastName}` : t('grades_section.unknown_student')
              const status = g.validationStatus || 'DRAFT'
              const sc = GRADE_STATUS_COLORS[status] || GRADE_STATUS_COLORS.DRAFT
              const isEditable = status === 'DRAFT' || status === 'REJECTED'
              return (
                <tr key={sid}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface)'}>
                  <td style={{ ...tdSt, color: 'var(--text3)', width: 38 }}>{i + 1}</td>
                  <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>
                    {name}
                    {rosterLabel && g.student?.className && <span style={{ fontWeight: 600, color: 'var(--text3)', fontSize: 11.5 }}> ({g.student.className})</span>}
                  </td>
                  <td style={tdSt}>
                    <input type="number" min={0} max={20} step={0.25}
                      value={notes[sid] ?? 0}
                      onChange={e => onNoteChange(sid, Number(e.target.value))}
                      disabled={!isEditable}
                      style={{ width: 68, padding: '5px 8px', border: '1.5px solid var(--border2)', borderRadius: 7, fontSize: 13.5, fontWeight: 800, textAlign: 'center', fontFamily: 'inherit', outline: 'none', background: !isEditable ? 'var(--bg2)' : 'var(--surface)', color: (notes[sid] ?? 0) < 10 ? 'var(--red)' : (notes[sid] ?? 0) >= 16 ? 'var(--green)' : 'var(--text)' }}
                    />
                  </td>
                  <td style={tdSt}>
                    <input type="text" value={observations[sid] || ''} placeholder={t('grades_section.observation_placeholder')}
                      onChange={e => onObservationChange(sid, e.target.value)}
                      disabled={!isEditable}
                      style={{ width: 200, padding: '5px 9px', border: '1.5px solid var(--border2)', borderRadius: 7, fontSize: 12, fontFamily: 'inherit', outline: 'none', background: !isEditable ? 'var(--bg2)' : 'var(--surface)', color: 'var(--text)' }}
                    />
                  </td>
                  <td style={tdSt}>
                    <span style={{ padding: '2.5px 8px', borderRadius: 14, fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.color }}>
                      {getGradeStatusLabel(status, t)}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Actions de sauvegarde & soumission */}
      <div className="p-3 sm:p-3.5 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <span className="text-xs text-[var(--text3)] font-semibold">
          {t('grades_section.summary_draft').replace('{count}', String(draftCount))}{rejectedCount > 0 ? ` · ${t('grades_section.summary_rejected').replace('{count}', String(rejectedCount))}` : ''} · {t('grades_section.summary_submitted').replace('{count}', String(grades.filter((g) => g.validationStatus === 'SUBMITTED').length))}
        </span>
        <div className="flex gap-2 w-full sm:w-auto">
          {modifiableCount > 0 ? (
            <>
              <button
                className="flex-1 sm:flex-initial h-11 sm:h-9 px-4 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
                style={btnSec}
                onClick={onSaveDraft}
                disabled={saving}
              >
                {saving ? <Loader2 size={13} strokeWidth={2} className="animate-spin" /> : <Save size={13} strokeWidth={2} />}
                <span>{saving ? '...' : t('grades_section.draft_save')}</span>
              </button>
              <button
                className="flex-1 sm:flex-initial h-11 sm:h-9 px-4 rounded-lg text-xs font-bold inline-flex items-center justify-center gap-2 text-white cursor-pointer"
                style={{ ...btnPrim, opacity: !isOnline ? 0.5 : 1, cursor: !isOnline ? 'not-allowed' : 'pointer' }}
                onClick={onSubmitGrades}
                disabled={saving || !isOnline}
              >
                {!isOnline ? <WifiOff size={13} strokeWidth={2} /> : <Upload size={13} strokeWidth={2} />}
                <span>{saving ? '...' : isOnline ? t('grades_section.submit_online') : t('grades_section.submit_offline')}</span>
              </button>
            </>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: 'var(--green)', fontWeight: 700 }}>
              <CheckCircle2 size={14} strokeWidth={2} />
              {t('grades_section.all_submitted')}
            </span>
          )}
        </div>
      </div>
    </>
  )
}
