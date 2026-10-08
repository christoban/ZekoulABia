export interface TimetableCellSlot {
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface TimetableGroupSlot extends TimetableCellSlot {
  groupId?: string | null
}

export interface UnassignedTimetableGroupSlot extends TimetableCellSlot {
  unassigned: true
}

export function timetableCellKey(slot: TimetableCellSlot): string {
  return `${slot.dayOfWeek}-${slot.startTime}-${slot.endTime}`
}

export function groupTimetableSlots<T extends TimetableCellSlot>(slots: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>()
  for (const slot of slots) {
    const key = timetableCellKey(slot)
    const values = grouped.get(key) ?? []
    values.push(slot)
    grouped.set(key, values)
  }
  return grouped
}

export function normalizeTimetableCellSlots<T extends { kind?: string }>(slots: readonly T[]): T[] {
  const courseSlots = slots.filter(slot => slot.kind !== 'FREE')
  if (courseSlots.length > 0) return courseSlots
  const freeSlot = slots.find(slot => slot.kind === 'FREE')
  return freeSlot ? [freeSlot] : []
}

export function groupTimetableSlotsForDisplay<T extends TimetableCellSlot & { kind?: string }>(slots: readonly T[]): Map<string, T[]> {
  const grouped = groupTimetableSlots(slots)
  return new Map([...grouped].map(([key, values]) => [key, normalizeTimetableCellSlots(values)]))
}

export function groupTimetableSlotsForStudent<T extends TimetableGroupSlot>(
  slots: readonly T[],
  studentGroupIds: readonly string[],
): Map<string, Array<T | UnassignedTimetableGroupSlot>> {
  const visibleGroupIds = new Set(studentGroupIds)
  const grouped: Map<string, T[]> = groupTimetableSlots<T>(slots)
  const visible = new Map<string, Array<T | UnassignedTimetableGroupSlot>>()

  for (const [key, values] of grouped) {
    const groupSlots = values.filter(slot => slot.groupId !== null && slot.groupId !== undefined && slot.groupId !== '')
    const visibleValues = values.filter(slot =>
      slot.groupId === null || slot.groupId === undefined || slot.groupId === '' || visibleGroupIds.has(slot.groupId),
    ) as Array<T | UnassignedTimetableGroupSlot>
    if (groupSlots.length > 0 && !visibleValues.some(slot => 'groupId' in slot && slot.groupId)) {
      const firstGroupSlot = groupSlots[0]
      visibleValues.push({ ...firstGroupSlot, unassigned: true })
    }
    visible.set(key, visibleValues)
  }

  return visible
}

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

export interface FormattedStudentTimetableData {
  slots: Record<string, CellSlots>
  className: string
  squelette: PeriodeGrille[]
  joursActifs: string[]
  squeletteParJour: Record<string, PeriodeGrille[]>
}

export const DEFAULT_TIMETABLE_SKELETON: PeriodeGrille[] = [
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

export function formatStudentTimetableData(
  timetablesRaw: any,
  gridConfigRaw: any,
  groupIds: readonly string[] = [],
  className: string = '',
  unassignedLabel = 'Non assigné au groupe'
): FormattedStudentTimetableData {
  let squelette: PeriodeGrille[] = DEFAULT_TIMETABLE_SKELETON
  let joursActifs: string[] = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI']
  let squeletteParJour: Record<string, PeriodeGrille[]> = {}

  const gridData = gridConfigRaw?.data ?? gridConfigRaw
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

  const slotMap: Record<string, CellSlots> = {}
  const colors = ['var(--green)', 'var(--blue)', 'var(--purple)', 'var(--amber)', 'var(--primary)', 'var(--red)', 'var(--orange)']
  let colorIdx = 0
  const subjectColors: Record<string, string> = {}

  const ttList: any[] = Array.isArray(timetablesRaw)
    ? timetablesRaw
    : Array.isArray(timetablesRaw?.data)
    ? timetablesRaw.data
    : []

  const rawSlots: RawSlot[] = ttList.flatMap((tt: { slots?: RawSlot[] }) => tt?.slots ?? [])

  for (const entries of groupTimetableSlotsForStudent(rawSlots, groupIds).values()) {
    const first = entries[0]
    if (!first) continue
    const key = `${first.dayOfWeek}-${first.startTime}`
    slotMap[key] = entries.map(entry => {
      if ('unassigned' in entry && entry.unassigned) {
        return {
          subject: unassignedLabel,
          teacher: '',
          room: '',
          kind: 'GROUP_UNASSIGNED',
          color: 'var(--text3)',
          unassigned: true,
        }
      }
      const rawEntry = entry as RawSlot
      const subName = rawEntry.subject?.name || ''
      if (subName && !subjectColors[subName]) {
        subjectColors[subName] = colors[colorIdx % colors.length]
        colorIdx++
      }
      return {
        subject: subName,
        teacher: rawEntry.teacher ? `${rawEntry.teacher.firstName} ${rawEntry.teacher.lastName}` : '',
        room: rawEntry.room || '',
        kind: rawEntry.kind || 'CLASS',
        color: subjectColors[subName] || 'var(--green)',
        groupId: rawEntry.groupId,
      }
    })
  }

  return {
    slots: slotMap,
    className,
    squelette,
    joursActifs,
    squeletteParJour,
  }
}

