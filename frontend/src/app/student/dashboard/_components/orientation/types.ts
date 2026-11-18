export type SuggestedTrack = {
  track: string
  score: number
  justification: string
}

export interface Recommandation {
  id: string
  status: string
  suggestedTracks: SuggestedTrack[] | null
  responseDeadline: string | null
  finalTrack: string | null
}

export interface Lv2Subject {
  id: string
  name: string
}

export interface Lv2WindowData {
  window: { id: string; level: string; openDate: string; closeDate: string }
  currentChoice: { subjectId: string; subjectName?: string } | null
  availableSubjects: Lv2Subject[]
}

export type ActiveCheckpointKey = 'FIN_TROISIEME' | 'FIN_SECONDE_C'
