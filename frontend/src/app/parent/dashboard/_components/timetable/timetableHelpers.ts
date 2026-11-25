import { groupTimetableSlotsForStudent } from '@/lib/timetableSlotGrouping'
import type { CellSlots, GridConfigShape, PeriodeGrille, RawSlot } from './types'

export const DAY_NAMES = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI', 'SAMEDI']

export const DAY_MAP: Record<string, number> = {
  LUNDI: 0,
  MARDI: 1,
  MERCREDI: 2,
  JEUDI: 3,
  VENDREDI: 4,
  SAMEDI: 5,
}

export const DEFAULT_DAYS = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']

// Fallback skeleton standard
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

export function resolveGridConfig(gridData: GridConfigShape | null) {
  let squelette: PeriodeGrille[] = DEFAULT_SKELETON
  let joursActifs: string[] = DEFAULT_DAYS
  let squeletteParJour: Record<string, PeriodeGrille[]> = {}

  if (gridData) {
    if (Array.isArray(gridData.squelette) && gridData.squelette.length > 0) {
      squelette = gridData.squelette
    }
    if (Array.isArray(gridData.config?.joursActifs) && gridData.config.joursActifs.length > 0) {
      joursActifs = gridData.config.joursActifs
    }
    if (gridData.squeletteParJour && typeof gridData.squeletteParJour === 'object') {
      squeletteParJour = gridData.squeletteParJour
    }
  }

  return { squelette, joursActifs, squeletteParJour }
}

export function buildSlots(
  data: Array<{ slots?: RawSlot[] }>,
  groupIds: string[],
  unassignedLabel: string
): Record<string, CellSlots> {
  const slotMap: Record<string, CellSlots> = {}
  const colors = ['var(--green)', 'var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--primary)', 'var(--red)', 'var(--orange)']
  let colorIdx = 0
  const subjectColors: Record<string, string> = {}
  const rawSlots: RawSlot[] = data.flatMap((tt: { slots?: RawSlot[] }) => tt.slots ?? [])

  for (const entries of groupTimetableSlotsForStudent(rawSlots, groupIds).values()) {
    const first = entries[0]
    // Indexation précise jour-heureDebut (ex: "0-07:30")
    const key = `${first.dayOfWeek}-${first.startTime}`
    slotMap[key] = entries.map((entry) => {
      if ('unassigned' in entry) {
        return {
          subject: unassignedLabel,
          teacher: '',
          room: '',
          kind: 'GROUP_UNASSIGNED',
          color: 'var(--text3)',
          unassigned: true,
        }
      }
      const subName = entry.subject?.name || ''
      if (subName && !subjectColors[subName]) {
        subjectColors[subName] = colors[colorIdx % colors.length]
        colorIdx++
      }
      return {
        subject: subName,
        teacher: entry.teacher ? `${entry.teacher.firstName} ${entry.teacher.lastName}` : '',
        room: entry.room || '',
        kind: entry.kind || 'CLASS',
        color: subjectColors[subName] || 'var(--green)',
        groupId: entry.groupId,
      }
    })
  }
  return slotMap
}
