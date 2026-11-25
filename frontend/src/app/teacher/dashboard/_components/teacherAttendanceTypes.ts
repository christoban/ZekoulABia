export type TeacherAttStatus = 'PRESENT' | 'ABSENT' | 'LATE'

export interface TeacherClassOption {
  id: string
  name: string
}

export interface TeacherSubjectOption {
  id: string
  name: string
}

export interface TeacherAttendanceStudent {
  id: string
  name: string
  firstName?: string
  lastName?: string
  matricule?: string
  className?: string
}

export interface LateEntryDetail {
  arrivedTime: string
  lateNote: string
}

export interface ExistingAttendanceApiRecord {
  studentId: string
  status: string
  arrivedAt?: string | null
  lateNote?: string | null
  student?: {
    id?: string
    name?: string
    firstName?: string
    lastName?: string
  } | null
}

export function getDefaultAttendancePeriod(): 'MORNING' | 'AFTERNOON' {
  const now = new Date()
  const hour = now.getHours()
  const minutes = now.getMinutes()
  return hour > 12 || (hour === 12 && minutes >= 30) ? 'AFTERNOON' : 'MORNING'
}

export function getCurrentHhMm(): string {
  const now = new Date()
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function isoToHhMm(iso?: string | null): string {
  if (!iso) return getCurrentHhMm()
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return getCurrentHhMm()
  return `${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`
}

export function buildArrivalIso(dateYmd: string, hhmm: string): string {
  const safeTime = /^\d{2}:\d{2}$/.test(hhmm) ? hhmm : getCurrentHhMm()
  const dt = new Date(`${dateYmd}T${safeTime}:00`)
  return Number.isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString()
}

