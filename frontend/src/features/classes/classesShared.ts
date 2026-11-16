export interface Teacher {
  id: string
  name: string
}

export interface TeachingAssignmentRow {
  currentTeacherId?: string | null
  currentTeacherName?: string | null
}

export interface StaffClassItem {
  id: string
  name: string
  level?: string
  filiere?: string
  serie?: string
  capacity?: number
  roomAssignment?: { roomName?: string }
  mainTeacher?: { nomComplet?: string; firstName?: string; lastName?: string }
  _count?: { students?: number; enrollments?: number }
}

export interface AcademicYearItem {
  id: string
  name: string
  isCurrent?: boolean
  status?: string
}

export function extractAssignedTeachers(rows: TeachingAssignmentRow[]): Teacher[] {
  const teachers = new Map<string, Teacher>()
  for (const row of rows) {
    if (row.currentTeacherId && row.currentTeacherName) {
      teachers.set(row.currentTeacherId, { id: row.currentTeacherId, name: row.currentTeacherName })
    }
  }
  return [...teachers.values()]
}

export const ALEVEL_MIN = 3
export const ALEVEL_MAX = 5

export function isSixthForm(cls: { level: string | null; name: string }): boolean {
  const src = `${cls.level ?? ''} ${cls.name}`.toLowerCase()
  return /sixth|lower\s*6|upper\s*6/.test(src)
}

export function isLV2Level(cls: { level: string | null }): boolean {
  if (!cls.level) return false
  return ['4e', '3e', '2nde', '1ère', 'Tle'].includes(cls.level)
}

export function serieToFiliere(serie: string): string {
  if (/^A4/.test(serie)) return 'Littéraire'
  if (serie === 'A') return 'Littéraire'
  if (serie === 'C' || serie === 'D') return 'Scientifique'
  if (serie === 'TI') return 'Technique'
  return ''
}

export function isCollegLevel(level: string, name: string): boolean {
  const src = (level || name).trim()
  return /^[3456](e|ème|e\s|$)/i.test(src)
}

export function inferFromName(name: string): { filiere: string; serie: string } {
  const n = name.trim()
  const a4Match = n.match(/A4[-\s](\w+)/i)
  if (a4Match) return { filiere: 'Littéraire', serie: `A4-${a4Match[1]}` }
  if (/\bA4\b/i.test(n)) return { filiere: 'Littéraire', serie: 'A4' }
  if (/\bTI\b/.test(n)) return { filiere: 'Technique', serie: 'TI' }
  if (/^(Tle|Terminale|1[eèê]re?|Première)\s/i.test(n)) {
    if (/\bC$/i.test(n)) return { filiere: 'Scientifique', serie: 'C' }
    if (/\bD$/i.test(n)) return { filiere: 'Scientifique', serie: 'D' }
  }
  return { filiere: '', serie: '' }
}

