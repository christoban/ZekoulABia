export interface KpiData {
  openCouncils: number
  pendingInvoices: number
  attendanceRate: string | null
  overdueBooks: number
}

export interface AdmissionsSummary {
  activeEvent: {
    title: string
    phase: string
    endDate?: string
    candidatsCount: number
    placesCount: number
  } | null
  aCompleter: number
  admisAFinaliser: number
  brouillons: number
  chezLaFamille: number
  enAttenteDirection: number
}

export interface CenseurSummary {
  activeClassesCount: number
  classesWithoutPPCount: number
  unassignedSubjectsCount: number
  openCouncilsCount: number
  activeAnonymatSessionsCount: number
  studentsAtRiskCount: number
  gridConfigured: boolean
}
