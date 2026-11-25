export interface EffectifClasse {
  classId: string
  className: string
  level: string | null
  serie: string | null
  filiere: string | null
  capacity: number
  totalInscrits: number
  garcons: number
  filles: number
  tauxOccupation: number
}

export interface RapportEffectifs {
  totalInscrits: number
  totalCapacite: number
  totalGarcons: number
  totalFilles: number
  tauxOccupationGlobal: number
  parClasse: EffectifClasse[]
  parCycle: {
    premierCycle: { inscrits: number; capacite: number; garcons: number; filles: number }
    secondCycle: { inscrits: number; capacite: number; garcons: number; filles: number }
  }
}

export interface DossierIncomplet {
  id: string
  nomProvisoire: string
  className: string | null
  contactTelephone: string | null
  completenessScore: number | null
  validableSousReserve: boolean
  status: string
  createdAt: string
  piecesManquantes: string[]
}

export interface StatConcours {
  sessionId: string
  sessionName: string
  examDate: string
  capacity: number
  totalCandidats: number
  admis: number
  listeAttente: number
  refuses: number
  tauxReussitePercent: number
  moyenneGenerale: number
}

export interface RapportGlobalData {
  effectifs: RapportEffectifs
  dossiersIncomplets: DossierIncomplet[]
  concours: StatConcours[]
}
