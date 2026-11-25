export interface Candidate {
  id: string
  candidateNumber?: string | null
  firstName: string
  lastName: string
  dateOfBirth?: string | null
  admissionStatus: string
  cepResult?: string | null
  parentPhone?: string | null
  examScore?: number | null
  rank?: number | null
}

export interface CandidatRapproche {
  candidateId: string
  candidateNumber?: string | null
  firstName: string
  lastName: string
  currentStatus: string
  proposedStatus: 'CONFIRME' | 'ANNULE'
  cepResult: 'REUSSI' | 'ECHOUE'
  parentPhone: string | null
}

export interface CandidatNonRapproche {
  item: { firstName?: string; lastName?: string; candidateNumber?: string }
  motif: string
}

export interface CandidatPromotion {
  candidateId: string
  firstName: string
  lastName: string
  rank: number | null
  examScore: number | null
  parentPhone: string | null
}

export interface PropositionResult {
  rapproches: CandidatRapproche[]
  nonRapproches: CandidatNonRapproche[]
  places: {
    totalProvisoires: number
    reussis: number
    echoues: number
    placesLiberees: number
  }
  promotionsProposees: CandidatPromotion[]
}

export interface CepProposeItem {
  candidateId?: string
  firstName?: string
  lastName?: string
  candidateNumber?: string
  dateOfBirth?: string
  cepResult: 'REUSSI' | 'ECHOUE'
}
