export type OrigineDossier = 'HORS_CONCOURS' | 'CONCOURS' | 'TRANSFERT' | 'AUTRE'
export type DispositifType = 'AUCUN' | 'SIMPLE' | 'SMARTPHONE_ANDROID' | 'IPHONE'

export interface ClasseSuggestion {
  id: string
  name: string
  level: string | null
  capacity: number
  effectifActuel: number
  placesRestantes: number
  estPleine: boolean
  tauxRemplissage: number
}

export interface CandidatConcoursSuggestion {
  id: string
  codeCandidat: string
  nom: string
  prenom: string
  dateNaissance: string
  gender: 'M' | 'F' | ''
  level: string
  classeId?: string
  contactEmail?: string
  contactTelephone?: string
  parentContactEmail?: string
  parentContactTelephone?: string
}

export interface ParentResponsable {
  nom: string
  prenom: string
  lien: 'PERE' | 'MERE' | 'TUTEUR' | 'AUTRE'
  telephone: string
  email: string
  profession: string
  adresse: string
  estPrincipal: boolean
  estFinancier: boolean
  contactUrgence: boolean
}

export interface StepperFormState {
  // Étape 1 — Élève
  origine: OrigineDossier
  candidatConcoursId?: string
  nom: string
  prenom: string
  sexe: 'M' | 'F' | ''
  dateNaissance: string // Format YYYY-MM-DD
  lieuNaissance: string
  nationalite: string
  photoUrl?: string
  sousSysteme: 'FRANCOPHONE' | 'ANGLOPHONE'
  matriculeNational?: string

  // Étape 2 — Scolarité
  level: string
  serie?: string
  classId: string
  etablissementOrigine: string
  derniereClasseSuivie: string
  anneePrecedente: string
  redoublant: boolean
  lv2?: string
  pebs?: string
  motifHorsConcours?: string
  derogationCapacite: boolean
  motifDerogation?: string

  // Étape 3 — Famille
  responsables: ParentResponsable[]
  aucunTelephoneDisponible: boolean

  // Étape 4 — Accès numérique
  dispositifEleve: DispositifType
  dispositifParent: DispositifType
  profilAccesManuel: boolean
  compteEleveType: 'AUCUN' | 'READ_ONLY' | 'FULL_ACCESS'
  gestionnaireProfil: 'PARENT' | 'ELEVE' | 'SECRETARIAT'
  canalNotification: 'APPLI_PARENT' | 'APPLI_ELEVE' | 'SMS' | 'PAPIER'

  // Étape 5 — Pièces
  validableSousReserve: boolean

  // Statut brouillon
  dernierEnregistrement?: string
}

export interface ProfilAccesCalcule {
  phraseClaire: string
  compteEleve: 'aucun' | 'lecture' | 'complet'
  profilGerePar: 'parent' | 'eleve' | 'secrétariat'
  canalNotification: 'appli' | 'sms' | 'papier'
}

/**
 * Règle canonique CycleResolver & Profil d'accès (MINESEC / MINEDUB).
 */
export function resoudreCycle(level: string): 'PREMIER_CYCLE' | 'SECOND_CYCLE' | 'AUTRE' {
  const clean = (level || '').trim().toLowerCase()
  if (/^(6|5|4|3|form\s*[1-5])/i.test(clean)) return 'PREMIER_CYCLE'
  if (/^(2nd|1er|tle|lower|upper|form\s*[6-7])/i.test(clean)) return 'SECOND_CYCLE'
  return 'PREMIER_CYCLE' // repli par défaut sécurisé
}

export function calculerProfilAcces(
  level: string,
  dispEleve: DispositifType,
  dispParent: DispositifType,
  aucunTel: boolean,
): ProfilAccesCalcule {
  if (aucunTel) {
    return {
      phraseClaire: 'Aucun téléphone disponible : l’élève et le parent seront informés sur support papier.',
      compteEleve: 'aucun',
      profilGerePar: 'secrétariat',
      canalNotification: 'papier',
    }
  }

  const cycle = resoudreCycle(level)
  const eleveHasSmartphone = dispEleve === 'SMARTPHONE_ANDROID' || dispEleve === 'IPHONE'
  const parentHasSmartphone = dispParent === 'SMARTPHONE_ANDROID' || dispParent === 'IPHONE'
  const parentHasTel = dispParent !== 'AUCUN'

  if (cycle === 'SECOND_CYCLE' && eleveHasSmartphone) {
    return {
      phraseClaire: 'Second cycle avec smartphone : l’élève gère son propre profil avec accès complet.',
      compteEleve: 'complet',
      profilGerePar: 'eleve',
      canalNotification: 'appli',
    }
  }

  if (parentHasSmartphone) {
    return {
      phraseClaire: 'Profil géré par le parent via l’application. L’élève bénéficie d’un compte supervisé.',
      compteEleve: eleveHasSmartphone ? 'lecture' : 'aucun',
      profilGerePar: 'parent',
      canalNotification: 'appli',
    }
  }

  if (parentHasTel) {
    return {
      phraseClaire: 'Pas de smartphone : notifications et suivi des notes envoyés par SMS au parent.',
      compteEleve: 'aucun',
      profilGerePar: 'parent',
      canalNotification: 'sms',
    }
  }

  return {
    phraseClaire: 'Tout passe par le secrétariat ; convocations et bulletins remis sur support papier.',
    compteEleve: 'aucun',
    profilGerePar: 'secrétariat',
    canalNotification: 'papier',
  }
}
