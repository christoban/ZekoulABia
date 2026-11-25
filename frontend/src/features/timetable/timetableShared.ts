export interface TimetableClassItem {
  id: string
  name: string
  academicYearId?: string
}

export interface TimetableSlot {
  id: string
  dayOfWeek: number
  startTime: string
  endTime: string
  room: string | null
  kind: string
  subject: { id: string; name: string } | null
  teacher: { id: string; firstName: string; lastName: string } | null
  isLV2Slot?: boolean
  groupId?: string | null
}

export interface TimetableData {
  id: string
  classId: string
  status: string
  generatedByAI?: boolean
  class: { id: string; name: string }
  slots: TimetableSlot[]
}

export interface PeriodeGrille {
  ordre: number
  debut: string
  fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'
  duree: number
}

export const DAY_NAME: Record<string, string> = {
  LUNDI: 'Lundi',
  MARDI: 'Mardi',
  MERCREDI: 'Mercredi',
  JEUDI: 'Jeudi',
  VENDREDI: 'Vendredi',
  SAMEDI: 'Samedi',
}

export const DAY_MAP: Record<string, number> = {
  LUNDI: 0,
  MARDI: 1,
  MERCREDI: 2,
  JEUDI: 3,
  VENDREDI: 4,
  SAMEDI: 5,
}

export const SUBJECT_PALETTES = [
  { bg: 'rgba(5,150,105,0.10)', border: 'var(--green)', text: 'var(--green2)' },
  { bg: 'rgba(37,99,235,0.09)', border: 'var(--blue)', text: 'var(--blue)' },
  { bg: 'rgba(217,119,6,0.09)', border: 'var(--amber)', text: 'var(--amber)' },
  { bg: 'rgba(139,92,246,0.09)', border: 'var(--purple)', text: 'var(--purple)' },
  { bg: 'rgba(236,72,153,0.09)', border: 'var(--red)', text: 'var(--red)' },
  { bg: 'rgba(142,42,58,0.09)', border: 'var(--primary)', text: 'var(--primary)' },
  { bg: 'rgba(239,68,68,0.09)', border: 'var(--red)', text: 'var(--red)' },
  { bg: 'rgba(251,146,60,0.09)', border: 'var(--orange)', text: 'var(--orange)' },
] as const

export function subjectColor(id: string) {
  let hash = 0
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff
  return SUBJECT_PALETTES[Math.abs(hash) % SUBJECT_PALETTES.length]
}

