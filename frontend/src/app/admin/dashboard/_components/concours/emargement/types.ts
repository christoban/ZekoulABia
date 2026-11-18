export type PresenceStatus = 'PRESENT' | 'ABSENT' | 'ABANDON'

export interface CandidateItem {
  id: string
  candidateNumber?: string | null
  firstName: string
  lastName: string
  deskNumber?: number | null
  presenceStatus?: PresenceStatus
  originSchool?: string | null
}

export interface EmargementStats {
  presents: number
  absents: number
  abandons: number
  total: number
}
