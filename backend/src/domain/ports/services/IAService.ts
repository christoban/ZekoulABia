/**
 * DOMAIN LAYER — Port Service Intelligence Artificielle
 * Implémenté par Groq via AI SDK.
 */
export interface DonneesIndiceSante {
  moyenneGenerale: number;    // /20
  tauxPresence: number;       // 0-100
  tendanceMoyennes: number[]; // Dernières 3 périodes
  nombreSanctions: number;
  tauxPaiement: number;       // 0-100
  langue?: 'fr' | 'en';       // langue des recommandations IA (défaut 'fr')
}

export interface ResultatIndiceSante {
  score: number;              // 0-100
  niveau: 'CRITIQUE' | 'ELEVE' | 'MOYEN' | 'STABLE' | 'PROGRESSION';
  recommandations: string[];
}

export interface IAService {
  calculerIndiceSante(donnees: DonneesIndiceSante): Promise<ResultatIndiceSante>;
  genererCommentaireBulletin(params: {
    nomEleve: string;
    moyenneGenerale: number;
    evolution: 'HAUSSE' | 'BAISSE' | 'STABLE';
    pointsForts: string[];
    pointsFaibles: string[];
    langue: 'FR' | 'EN';
  }): Promise<string>;
  genererEmploiDuTemps(contraintes: Record<string, unknown>): Promise<Record<string, unknown>>;
  genererConseilPersonnalise(params: {
    nomEleve: string;
    contexte: string;
    destinataire: 'ELEVE' | 'PARENT' | 'ENSEIGNANT';
    langue?: 'fr' | 'en';
  }): Promise<string>;
}
