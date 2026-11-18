export interface SectionSubjectsProps {
  onToast: (msg: string, type?: 'success' | 'error' | 'info') => void
  onNav?: (section: import('../../_types').AdminSection) => void
}

export type SubjectsView = 'catalogue' | 'par-classe' | 'departements' | 'par-enseignant'

export interface ClassItem {
  id: string
  name: string
  level: string | null
}

export interface ClassSubjectItem {
  id: string
  subjectId: string
  name: string
  code: string | null
  coefficient: number
  serieCode: string | null
  classOnly: boolean
}

export interface SubjectItem {
  id: string
  name: string
  code: string | null
  coefficient: number
  hoursPerWeek: number
  subjectType: string
  teacherSubjects: { teacherProfile: { user: { id: string; firstName: string; lastName: string } } }[]
}

export interface Teacher {
  id: string
  firstName: string
  lastName: string
}

export interface TeacherWithSubjects extends Teacher {
  teacherProfile?: {
    supervisedSubjectIds?: string[]
    teacherSubjects?: { subjectId: string; subject: { name: string } }[]
  }
  subjects?: { id: string; name: string }[]
}

export interface Department {
  id: string
  name: string
  color: string
  head: { id: string; firstName: string; lastName: string } | null
  subjects: { id: string; name: string; avgCoeff?: number }[]
}

export type DepartmentView = Department & { _virtual?: boolean }

export const COEFF_SERIES = ['A4', 'A', 'C', 'D', 'TI']
export const COEFF_LEVELS = ['2nde', '1ère', 'Tle']

const AVATAR_PALETTE = ['var(--green)', 'var(--blue)', 'var(--amber)', 'var(--purple)', 'var(--red)', 'var(--primary)']

export function avatarColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length]
}
