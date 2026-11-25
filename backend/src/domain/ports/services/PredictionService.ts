/**
 * DOMAIN LAYER — Port PredictionService (infrastructure prédictive, Partie B du plan)
 *
 * Même logique que IAService : une interface, deux adapters possibles. L'adapter à seuils/
 * règles (RulesBasedPredictionService) reste seul à piloter de vraies décisions en production
 * (rien n'y change). L'adapter TabPFN v2 (TabPfnPredictionService) existe en parallèle pour
 * être testé sur des données réelles, mais AUCUN de ses résultats ne pilote de notification
 * réelle tant qu'un cycle complet de résultats connus n'a pas validé sa fiabilité — voir
 * PLAN_IMPLEMENTATION_CLAUDE_CODE.md Partie B.5.
 */

export interface EleveFeatures {
  moyenneGenerale: number; // sur 20
  tauxPresence: number; // 0-100
  tendanceMoyennes: number[]; // sur 20, chronologique
  nombreSanctions: number;
  nombrePeriodes: number;
  tauxPaiement: number; // 0-100
}

export interface PaiementFeatures {
  montantDu: number;
  joursRetard: number;
  echeancesRespectees: number;
  echeancesTotal: number;
  montantMoyenPaiement: number;
}

export interface OrientationFeatures {
  moyennesMatieres: Record<string, number>; // sur 20, par nom de matière
  scientificAptitude?: number; // 0-100, si test psychotechnique passé
  literaryAptitude?: number; // 0-100
  technicalAptitude?: number; // 0-100
  aspirationTrack?: string;
}

export type NiveauRisque = 'FAIBLE' | 'MOYEN' | 'ELEVE' | 'CRITIQUE';
export type PredictionSource = 'RULES' | 'TABPFN';

export interface RiskScore {
  score: number; // 0-100 — 100 = risque maximal
  niveau: NiveauRisque;
  source: PredictionSource;
}

export interface TrackScore {
  track: string;
  score: number;
}

export interface TrackScores {
  scores: TrackScore[];
  source: PredictionSource;
}

export interface PredictionService {
  predireRisqueEleve(features: EleveFeatures): Promise<RiskScore>;
  predireRisqueImpaye(features: PaiementFeatures): Promise<RiskScore>;
  recommanderSerieOrientation(features: OrientationFeatures): Promise<TrackScores>;
}
