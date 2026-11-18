export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export interface Period {
  id: string
  name: string
  isCurrent?: boolean
}

export interface ReportCard {
  id: string
  studentId: string
  studentName: string
  generalAverage: number | null
  classMasterComment: string | null
  status: string
}

export const QUICK_CHIPS_KEYS = [
  'chip_satisfactory',
  'chip_can_improve',
  'chip_progressing',
  'chip_encouraging',
  'chip_effort_needed',
]
