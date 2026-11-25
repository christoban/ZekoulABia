/**
 * Points de départ configurables du moteur de scoring (A.4.2 du plan) — stockés dans
 * OrientationCheckpointConfig.relevantSubjects (Json), jamais en dur dans l'algorithme.
 * Ces constantes ne servent qu'à PRÉ-REMPLIR la config d'une école qui n'a encore rien réglé —
 * une fois enregistrée en base, c'est la config réelle qui fait foi.
 */
export type TrackWeights = {
  subjects: string[];
  // Poids de la moyenne des matières déterminantes — variante "sans test" (toujours applicable,
  // socle valable pour tout établissement) et "avec test" (recalibrée quand le test existe).
  subjectWeightNoTest: number;
  subjectWeightWithTest: number;
  aptitudeField?: 'scientificAptitude' | 'literaryAptitude' | 'technicalAptitude';
  aptitudeWeightWithTest: number;
  aspirationWeight: number;
  // TI uniquement : signal d'intérêt informatique déclaré (career interest), en plus de l'aptitude.
  interestSignalWeight?: number;
};

export type CheckpointScoringConfig = Record<string, TrackWeights>;

export const DEFAULT_FIN_TROISIEME_CONFIG: CheckpointScoringConfig = {
  C: {
    subjects: ['Mathématiques', 'Physique-Chimie-Technologie', 'SVTEEHB'],
    subjectWeightNoTest: 0.8, subjectWeightWithTest: 0.5,
    aptitudeField: 'scientificAptitude', aptitudeWeightWithTest: 0.3,
    aspirationWeight: 0.2,
  },
  A: {
    subjects: ['Français', 'Histoire-Géographie', 'Anglais'],
    subjectWeightNoTest: 0.8, subjectWeightWithTest: 0.5,
    aptitudeField: 'literaryAptitude', aptitudeWeightWithTest: 0.3,
    aspirationWeight: 0.2,
  },
  SES: {
    subjects: ['Mathématiques', 'Histoire-Géographie', 'Français'],
    subjectWeightNoTest: 0.7, subjectWeightWithTest: 0.4,
    aptitudeWeightWithTest: 0.3, // moyenne des deux aptitudes — géré au moment du calcul
    aspirationWeight: 0.3,
  },
};

export const DEFAULT_FIN_SECONDE_C_CONFIG: CheckpointScoringConfig = {
  C: {
    subjects: ['Mathématiques', 'Physique-Chimie-Technologie'],
    subjectWeightNoTest: 0.7, subjectWeightWithTest: 0.5,
    aptitudeField: 'scientificAptitude', aptitudeWeightWithTest: 0.3,
    aspirationWeight: 0.2,
  },
  D: {
    subjects: ['Mathématiques', 'SVTEEHB', 'Physique-Chimie-Technologie'],
    subjectWeightNoTest: 0.7, subjectWeightWithTest: 0.5,
    aptitudeField: 'scientificAptitude', aptitudeWeightWithTest: 0.3,
    aspirationWeight: 0.2,
  },
  TI: {
    subjects: ['Mathématiques', 'Physique-Chimie-Technologie'],
    subjectWeightNoTest: 0.8, subjectWeightWithTest: 0.5,
    aptitudeField: 'technicalAptitude', aptitudeWeightWithTest: 0.3,
    aspirationWeight: 0, interestSignalWeight: 0.2,
  },
};

export function defaultConfigFor(type: 'FIN_TROISIEME' | 'FIN_SECONDE_C'): CheckpointScoringConfig {
  return type === 'FIN_TROISIEME' ? DEFAULT_FIN_TROISIEME_CONFIG : DEFAULT_FIN_SECONDE_C_CONFIG;
}
