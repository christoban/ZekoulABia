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
