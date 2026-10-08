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

export interface StudentGroupingOptions {
  studentGroupIds?: readonly string[]
  studentLv2SubjectId?: string | null
  studentLv2SubjectName?: string | null
}

function isStudentGroupingOptions(
  val: readonly string[] | StudentGroupingOptions,
): val is StudentGroupingOptions {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

export function groupTimetableSlotsForStudent<T extends TimetableGroupSlot>(
  slots: readonly T[],
  studentGroupIdsOrOptions: readonly string[] | StudentGroupingOptions,
): Map<string, Array<T | UnassignedTimetableGroupSlot>> {
  let studentGroupIds: readonly string[] = []
  let studentLv2SubjectId: string | null = null
  let studentLv2SubjectName: string | null = null

  if (isStudentGroupingOptions(studentGroupIdsOrOptions)) {
    studentGroupIds = studentGroupIdsOrOptions.studentGroupIds ?? []
    studentLv2SubjectId = studentGroupIdsOrOptions.studentLv2SubjectId ?? null
    studentLv2SubjectName = studentGroupIdsOrOptions.studentLv2SubjectName ?? null
  } else {
    studentGroupIds = studentGroupIdsOrOptions
  }

  const visibleGroupIds = new Set(studentGroupIds)
  const grouped: Map<string, T[]> = groupTimetableSlots<T>(slots)
  const visible = new Map<string, Array<T | UnassignedTimetableGroupSlot>>()

  for (const [key, values] of grouped) {
    const groupSlots = values.filter(slot => slot.groupId !== null && slot.groupId !== undefined && slot.groupId !== '')

    // Vérifie si la matière du slot correspond au choix LV2/filière de l'élève
    const isSlotMatchingStudentLv2 = (slot: T) => {
      if (!studentLv2SubjectId && !studentLv2SubjectName) return false
      const sub = (slot as any).subject
      const subId = (slot as any).subjectId || (typeof sub === 'object' ? sub?.id : undefined)
      if (studentLv2SubjectId && subId && subId === studentLv2SubjectId) return true
      const subName = (typeof sub === 'string' ? sub : sub?.name)?.trim().toLowerCase()
      if (studentLv2SubjectName && subName && subName === studentLv2SubjectName.trim().toLowerCase()) return true
      return false
    }

    const visibleValues = values.filter(slot => {
      const isGroupSlot = slot.groupId !== null && slot.groupId !== undefined && slot.groupId !== ''
      if (!isGroupSlot) return true
      if (visibleGroupIds.has(slot.groupId!)) return true
      if (isSlotMatchingStudentLv2(slot)) return true
      return false
    }) as Array<T | UnassignedTimetableGroupSlot>

    if (groupSlots.length > 0 && visibleValues.length === 0) {
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
  unassignedLabel = 'Non assigné au groupe',
  lv2Options?: { studentLv2SubjectId?: string | null; studentLv2SubjectName?: string | null }
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

  const groupingOptions: StudentGroupingOptions = {
    studentGroupIds: groupIds,
    studentLv2SubjectId: lv2Options?.studentLv2SubjectId,
    studentLv2SubjectName: lv2Options?.studentLv2SubjectName,
  }

  for (const entries of groupTimetableSlotsForStudent(rawSlots, groupingOptions).values()) {
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

