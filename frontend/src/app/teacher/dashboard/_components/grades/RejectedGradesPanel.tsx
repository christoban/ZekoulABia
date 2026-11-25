'use client'
import { X, Pencil } from 'lucide-react'
import { thSt, tdSt, type TeacherGradeRow, type TranslateFn } from './types'

interface Props {
  rejectedGrades: TeacherGradeRow[]
  onCorrectGrade: (grade: TeacherGradeRow) => void
  t: TranslateFn
}

export default function RejectedGradesPanel({ rejectedGrades, onCorrectGrade, t }: Props) {
  if (rejectedGrades.length === 0) return null

  return (
    <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1.5px solid rgba(220,38,38,0.3)', overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: 'var(--red-light)', borderBottom: '1px solid rgba(220,38,38,0.15)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <X size={14} strokeWidth={2} color="var(--red)" />
        <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--red)' }}>{t('grades_section.rejected_title').replace('{count}', String(rejectedGrades.length))}</span>
      </div>

      {/* Vue mobile: Cartes notes rejetées */}
      <div className="md:hidden divide-y divide-[rgba(220,38,38,0.15)]">
        {rejectedGrades.map((g) => (
          <div key={g.id} className="p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[13px] font-bold text-[var(--text)]">{g.student?.firstName} {g.student?.lastName}</div>
                <div className="text-xs font-black text-[var(--red)] mt-0.5">{g.sequenceScore ?? '?'}/20</div>
              </div>
              <button
                className="h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                style={{ background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid rgba(217,119,6,0.3)', fontFamily: 'inherit' }}
                onClick={() => onCorrectGrade(g)}>
                <Pencil size={12} strokeWidth={2} />
                <span>{t('grades_section.rejected_correct')}</span>
              </button>
            </div>
            <div className="text-xs text-[var(--red)] font-semibold bg-[rgba(220,38,38,0.06)] p-2 rounded-lg">
              {g.rejectionReason || t('grades_section.rejected_no_reason')}
            </div>
          </div>
        ))}
      </div>

      {/* Vue desktop: Table */}
      <div className="hidden md:block" style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
          <thead><tr>{[t('grades_section.rejected_table_student'), t('grades_section.rejected_table_grade'), t('grades_section.rejected_table_reason'), t('grades_section.rejected_table_actions')].map(h => <th key={h} style={thSt}>{h}</th>)}</tr></thead>
          <tbody>
            {rejectedGrades.map((g) => (
              <tr key={g.id}>
                <td style={{ ...tdSt, fontWeight: 700, color: 'var(--text)' }}>{g.student?.firstName} {g.student?.lastName}</td>
                <td style={{ ...tdSt, fontWeight: 800, color: 'var(--red)' }}>{g.sequenceScore ?? '?'}/20</td>
                <td style={{ ...tdSt, color: 'var(--red)', fontWeight: 700 }}>{g.rejectionReason || t('grades_section.rejected_no_reason')}</td>
                <td style={tdSt}>
                  <button
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 7, fontSize: 12, fontWeight: 800, background: 'var(--amber-light)', color: 'var(--amber)', border: '1px solid rgba(217,119,6,0.3)', cursor: 'pointer', fontFamily: 'inherit' }}
                    onClick={() => onCorrectGrade(g)}>
                    <Pencil size={13} strokeWidth={2} />{t('grades_section.rejected_correct')}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
