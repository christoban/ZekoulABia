/**
 * DOMAIN LAYER — Règles pures de calcul de l'indice de santé scolaire
 *
 * Extrait de CalculerIndiceSanteUseCase (Phase B du plan prédictif) pour devenir la source
 * unique et réutilisable de l'adapter à seuils/règles (RulesBasedPredictionService) SANS
 * dupliquer la formule ni changer le comportement de l'use case existant, qui reste la seule
 * voie réellement appelée en production — ce fichier n'est qu'une extraction, pas une réécriture.
 *
 * 5 composantes pondérées (source : ZekoulABia spec) :
 * - Notes        : 35% — moyenne générale normalisée (0-20 → 0-100)
 * - Assiduité    : 25% — (jours présent / jours total) × 100
 * - Tendance     : 20% — évolution sur 3 dernières périodes
 * - Comportement : 10% — sanctions / nombre de périodes
 * - Paiements    : 10% — frais réglés / frais totaux
 *
 * Niveaux : 0-30 CRITIQUE | 31-50 ELEVE | 51-70 MOYEN | 71-85 STABLE | 86-100 PROGRESSION
 */

// Poids partagés entre la version "comptages bruts" (use case existant) et la version
// "taux déjà calculés" (RulesBasedPredictionService — même contrat de features que TabPFN).
export const POIDS_INDICE_SANTE = {
  notes: 0.35,
  presence: 0.25,
  tendance: 0.20,
  comportement: 0.10,
  paiements: 0.10,
} as const;

export interface DonneesIndiceSante {
  moyenneGenerale: number;
  joursPresent: number;
  joursTotaux: number;
  moyennesPrecedentes: number[];
  nombreSanctions: number;
  nombrePeriodes: number;
  fraisRegles: number;
  fraisTotaux: number;
}

export interface ComposantesIndiceSante {
  scoreNotes: number;
  tauxPresence: number;
  scoreTendance: number;
  scoreComportement: number;
  scorePaiements: number;
  score: number;
}

export function calculerTendance(moyennes: number[]): number {
  if (moyennes.length < 2) return 50;

  const dernieres = moyennes.slice(-3);
  let tendance = 50;

  for (let i = 1; i < dernieres.length; i++) {
    const diff = dernieres[i]! - dernieres[i - 1]!;
    if (diff >= 2) tendance += 25;
    else if (diff >= 0.5) tendance += 10;
    else if (diff <= -2) tendance -= 25;
    else if (diff < 0) tendance -= 10;
  }

  return Math.max(0, Math.min(100, tendance));
}

export function calculerComposantesSante(donnees: DonneesIndiceSante): ComposantesIndiceSante {
  const scoreNotes = Math.min(100, (donnees.moyenneGenerale / 20) * 100);

  const tauxPresence = donnees.joursTotaux > 0
    ? (donnees.joursPresent / donnees.joursTotaux) * 100
    : 100;

  const scoreTendance = calculerTendance(donnees.moyennesPrecedentes);

  const scoreComportement = donnees.nombrePeriodes > 0
    ? Math.max(0, 100 - (donnees.nombreSanctions / donnees.nombrePeriodes) * 20)
    : 100;

  const scorePaiements = donnees.fraisTotaux > 0
    ? (donnees.fraisRegles / donnees.fraisTotaux) * 100
    : 100;

  const scoreBrut = Math.round(
    scoreNotes * POIDS_INDICE_SANTE.notes +
    tauxPresence * POIDS_INDICE_SANTE.presence +
    scoreTendance * POIDS_INDICE_SANTE.tendance +
    scoreComportement * POIDS_INDICE_SANTE.comportement +
    scorePaiements * POIDS_INDICE_SANTE.paiements
  );

  return {
    scoreNotes, tauxPresence, scoreTendance, scoreComportement, scorePaiements,
    score: Math.max(0, Math.min(100, scoreBrut)),
  };
}

/**
 * Variante "taux déjà calculés" de la même formule — utilisée par RulesBasedPredictionService,
 * dont le contrat de features (EleveFeatures) porte des taux déjà normalisés plutôt que des
 * comptages bruts (c'est aussi la forme la plus portable pour nourrir un modèle TabPFN plus
 * tard). Mêmes poids, même formule, juste une entrée déjà normalisée — pas une formule différente.
 */
export function calculerScoreDepuisTaux(donnees: {
  moyenneGenerale: number;
  tauxPresence: number;
  tendanceMoyennes: number[];
  nombreSanctions: number;
  nombrePeriodes: number;
  tauxPaiement: number;
}): number {
  const scoreNotes = Math.min(100, (donnees.moyenneGenerale / 20) * 100);
  const scoreTendance = calculerTendance(donnees.tendanceMoyennes);
  const scoreComportement = donnees.nombrePeriodes > 0
    ? Math.max(0, 100 - (donnees.nombreSanctions / donnees.nombrePeriodes) * 20)
    : 100;

  const scoreBrut = Math.round(
    scoreNotes * POIDS_INDICE_SANTE.notes +
    donnees.tauxPresence * POIDS_INDICE_SANTE.presence +
    scoreTendance * POIDS_INDICE_SANTE.tendance +
    scoreComportement * POIDS_INDICE_SANTE.comportement +
    donnees.tauxPaiement * POIDS_INDICE_SANTE.paiements
  );

  return Math.max(0, Math.min(100, scoreBrut));
}

export function niveauDepuisScore(score: number): 'CRITIQUE' | 'ELEVE' | 'MOYEN' | 'STABLE' | 'PROGRESSION' {
  if (score <= 30) return 'CRITIQUE';
  if (score <= 50) return 'ELEVE';
  if (score <= 70) return 'MOYEN';
  if (score <= 85) return 'STABLE';
  return 'PROGRESSION';
}
