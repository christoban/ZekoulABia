import type { CSSProperties } from 'react'

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export interface PeriodeGrille {
  ordre: number
  debut: string
  fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'
  duree: number
}

export type SlotType = {
  subject: string
  classe: string
  teacher?: string
  room: string
  kind: string
  isMine: boolean
  groupId?: string | null
}
export type CellSlots = SlotType[]

export const DAY_NAMES = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']
export const DAY_MAP: Record<string, number> = {
  LUNDI: 0, MARDI: 1, MERCREDI: 2, JEUDI: 3, VENDREDI: 4, SAMEDI: 5,
}

// Fallback skeleton standard si la grille n'a pas encore été configurée
export const DEFAULT_SKELETON: PeriodeGrille[] = [
  { ordre: 1, debut: '07:30', fin: '08:25', type: 'COURS', duree: 55 },
  { ordre: 2, debut: '08:25', fin: '09:20', type: 'COURS', duree: 55 },
  { ordre: 0, debut: '09:20', fin: '09:35', type: 'PETITE_PAUSE', duree: 15 },
  { ordre: 3, debut: '09:35', fin: '10:30', type: 'COURS', duree: 55 },
  { ordre: 4, debut: '10:30', fin: '11:25', type: 'COURS', duree: 55 },
  { ordre: 5, debut: '11:25', fin: '12:20', type: 'COURS', duree: 55 },
  { ordre: 0, debut: '12:20', fin: '12:50', type: 'GRANDE_PAUSE', duree: 30 },
  { ordre: 6, debut: '12:50', fin: '13:45', type: 'COURS', duree: 55 },
  { ordre: 7, debut: '13:45', fin: '14:40', type: 'COURS', duree: 55 },
]

export interface CatchupFormState {
  open: boolean
  classId: string
  proposedDate: string
  subjectId: string
  proposedStartTime: string
  proposedEndTime: string
  reason: string
  loading: boolean
  error: string
}

export const EMPTY_CATCHUP: CatchupFormState = {
  open: false,
  classId: '',
  proposedDate: '',
  subjectId: '',
  proposedStartTime: '',
  proposedEndTime: '',
  reason: '',
  loading: false,
  error: '',
}

export interface TeacherTtSlot {
  dayOfWeek: number
  startTime: string
  endTime?: string
  room?: string | null
  kind?: string
  groupId?: string | null
  subject?: { id?: string; name?: string | null } | null
  teacher?: { id: string; firstName?: string; lastName?: string } | null
}

export interface TeacherTtRow {
  class?: { id: string; name?: string | null } | null
  slots?: TeacherTtSlot[]
}

export interface TeacherGridConfig {
  squelette?: PeriodeGrille[]
  config?: { joursActifs?: string[] }
  squeletteParJour?: Record<string, PeriodeGrille[]>
}

export function getDayLabel(dayName: string, t: TranslateFn): string {
  switch (dayName) {
    case 'LUNDI': return t('timetable.day_monday')
    case 'MARDI': return t('timetable.day_tuesday')
    case 'MERCREDI': return t('timetable.day_wednesday')
    case 'JEUDI': return t('timetable.day_thursday')
    case 'VENDREDI': return t('timetable.day_friday')
    case 'SAMEDI': return t('timetable.day_saturday')
    default: return dayName
  }
}

export const sTitle: CSSProperties = { fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700, color: 'var(--text)' }
export const sSub: CSSProperties = { fontSize: 12, color: 'var(--text3)', marginTop: 2 }
export const thSt: CSSProperties = { padding: '8px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.5px' }
export const catchSLb: CSSProperties = { fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }
export const catchSIn: CSSProperties = { width: '100%', minHeight: 36, padding: '6px 10px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10, outline: 'none' }
