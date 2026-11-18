import type { ChildWithStats } from '../../_types'
import type { TimetableGroupSlot } from '@/lib/timetableSlotGrouping'

export interface PeriodeGrille {
  ordre: number
  debut: string
  fin: string
  type: 'COURS' | 'PETITE_PAUSE' | 'GRANDE_PAUSE'
  duree: number
}

export type SlotType = {
  subject: string
  teacher: string
  room: string
  kind: string
  color: string
  groupId?: string | null
  unassigned?: boolean
}

export type RawSlot = TimetableGroupSlot & {
  subject?: { name?: string | null } | null
  teacher?: { firstName: string; lastName: string } | null
  room?: string | null
  kind?: string | null
}

export type CellSlots = SlotType[]

export interface TimetableData {
  children: ChildWithStats[]
  slotsByChild: Record<string, Record<string, CellSlots>>
  classNames: Record<string, string>
  squelette: PeriodeGrille[]
  joursActifs: string[]
  squeletteParJour: Record<string, PeriodeGrille[]>
}

export interface GridConfigShape {
  squelette?: PeriodeGrille[]
  config?: { joursActifs?: string[] }
  squeletteParJour?: Record<string, PeriodeGrille[]>
}
