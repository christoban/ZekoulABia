export interface ImportMatriculeRow {
  ligne: number;
  nom: string;
  prenom: string;
  dateNaissance?: string;
  matricule: string;
  etablissement?: string;
}

/** Correspondance approximative (Niveau 2) — en attente de décision de l'admin. */
export interface FuzzyMatchCandidate {
  ligne: number;
  studentProfileId: string;
  userId: string;
  nomFichier: string;
  prenomFichier: string;
  nomBase: string;
  prenomBase: string;
  dateNaissance: string | null;
  matriculeNouveau: string;
  /** 0-100, arrondi, pour affichage lisible ("92% de similarité"). */
  similarityPercent: number;
  status: 'PENDING' | 'CONFIRMED' | 'FLAGGED';
}

export interface ImportMatriculeResult {
  jobId: string;
  total: number;
  /** Total matché (exact + fuzzy confirmé) — inclut donc matchedExact au moment de l'import. */
  matched: number;
  matchedExact: number;
  /** Correspondances probables détectées, en attente de confirmation admin (pas encore comptées dans `matched`). */
  fuzzyPending: number;
  unmatched: number;
  conflicts: number;
  errors: number;
  unmatchedDetails: { ligne: number; nom: string; prenom: string; raison: string }[];
  fuzzyMatches: FuzzyMatchCandidate[];
}

export interface MatriculeMatchResult {
  studentProfileId: string;
  userId: string;
  nom: string;
  prenom: string;
  matriculeActuel: string | null;
  matriculeNouveau: string;
  action: 'UPDATED' | 'CONFLICT' | 'ALREADY_MATCHED';
}

export interface ConfirmerFuzzyCommande {
  schoolId: string;
  jobId: string;
  ligne: number;
}

export interface SignalerErreurCommande {
  schoolId: string;
  jobId: string;
  ligne: number;
}
