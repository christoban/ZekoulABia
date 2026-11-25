export interface EntranceExamSession {
  id: string
  name: string
  status: string
  examDate: string
  admissionThreshold: number | null
  availableSeats: number | null
  registrationFee?: number | null
  seatReservationDays?: number | null
}

export interface EntranceExamSubject {
  id: string
  name: string
  coefficient: number
  maxScore: number
  eliminatoryScore?: number | null
}

export interface EntranceExamRoom {
  id: string
  sessionId: string
  name: string
  capacity: number
  assignedCandidatesCount?: number
}

export interface EntranceExamCandidate {
  id: string
  candidateNumber?: string | null
  firstName: string
  lastName: string
  examScore: number | null
  totalAverage?: number | null
  rank?: number | null
  roomName?: string | null
  deskNumber?: number | null
  admissionStatus: string
  cepResult: string | null
  cepResultDate: string | null
  studentProfileId: string | null
  grades?: { subjectId: string; score: number | null; isAbsent: boolean }[]
}

export interface EntranceExamSummary {
  session: EntranceExamSession
  total: number
  pending: number
  admisProvisoire: number
  confirms: number
  annules: number
  cepPending: number
  candidates: EntranceExamCandidate[]
}

export type EntranceExamStaffTab =
  | 'CANDIDATS'
  | 'SALLES'
  | 'EMARGEMENT'
  | 'NOTES'
  | 'RESULTATS'
  | 'CEP'
  | 'FINALISATION'

export function getProchaineActionConcours(status: string): { text: string; tab?: EntranceExamStaffTab } {
  switch (status) {
    case 'DRAFT':
    case 'REGISTRATION_OPEN':
      return { text: 'Inscrire les candidats et réceptionner les dossiers', tab: 'CANDIDATS' }
    case 'SEATS_ASSIGNED':
      return { text: 'Répartir les candidats dans les salles et imprimer les convocations', tab: 'SALLES' }
    case 'IN_PROGRESS':
      return { text: "Procéder à l'émargement des candidats présents", tab: 'EMARGEMENT' }
    case 'GRADING':
      return { text: 'Saisir les notes des épreuves écrites', tab: 'NOTES' }
    case 'DELIBERATION':
      return { text: 'Délibération en cours par la direction (simulation des seuils)' }
    case 'PUBLISHED':
      return { text: 'Saisir les résultats du CEP et finaliser les admissions confirmées', tab: 'CEP' }
    case 'CLOSED':
      return { text: 'Session clôturée' }
    default:
      return { text: 'Consulter les candidats et les résultats' }
  }
}

