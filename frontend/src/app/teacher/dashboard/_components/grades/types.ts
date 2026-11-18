import type { CSSProperties } from 'react'

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export interface TeacherClassOption { id: string; name: string }
export interface TeacherSubjectOption { id: string; name: string }
export interface TeacherSequenceOption {
  id: string
  name: string
  periodName?: string
  academicYearId?: string
  [key: string]: unknown
}
export interface TeacherStudentRef {
  id?: string
  firstName: string
  lastName: string
  className?: string
}
export interface TeacherGradeRow {
  id?: string
  studentId: string
  student?: TeacherStudentRef | null
  sequenceScore?: number | null
  sequenceAverage?: number | null
  observation?: string | null
  validationStatus?: string
  classId?: string
  subjectId?: string
  sequenceId?: string
  rejectionReason?: string | null
}
export interface GradesImportResult {
  imported: number
  errors: { line: number; matricule: string; error: string }[]
  total: number
}
export interface GradesLocalDraft {
  notes: Record<string, number>
  observations: Record<string, string>
}

export const GRADE_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  DRAFT: { bg: 'var(--bg2)', color: 'var(--text2)' },
  SUBMITTED: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  VALIDATED: { bg: 'var(--green-light)', color: 'var(--green)' },
  REJECTED: { bg: 'var(--red-light)', color: 'var(--red)' },
  LOCKED: { bg: 'var(--blue-light)', color: 'var(--blue)' },
}

export function getGradeStatusLabel(status: string, t: TranslateFn): string {
  switch (status) {
    case 'DRAFT': return t('grades_section.status_draft')
    case 'SUBMITTED': return t('grades_section.status_submitted')
    case 'VALIDATED': return t('grades_section.status_validated')
    case 'REJECTED': return t('grades_section.status_rejected')
    case 'LOCKED': return t('grades_section.status_locked')
    default: return status
  }
}

export const sTitle: CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
export const sSub: CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
export const btnPrim: CSSProperties = { padding: '6px 13px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }
export const btnSec: CSSProperties = { padding: '6px 12px', borderRadius: 7, fontSize: 12.5, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', cursor: 'pointer', fontFamily: 'inherit' }
export const filterSt: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 24px 5px 10px',
  fontSize: 12, fontWeight: 700, color: 'var(--text)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit', appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%238c6b45' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center',
}
export const thSt: CSSProperties = {
  padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 800, color: 'var(--text3)',
  background: 'var(--bg2)', borderBottom: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap',
}
export const tdSt: CSSProperties = { padding: '8.5px 12px', fontSize: 12.5, color: 'var(--text2)', borderBottom: '1px solid var(--bg)', verticalAlign: 'middle' }
