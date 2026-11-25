/**
 * DOMAIN LAYER — Règle métier pure : classification académique par matière (V1.1)
 *
 * Détermine la classification (FORCE / ACQUIS / FAIBLE / CRITIQUE) et la tendance
 * d'une matière en fonction des moyennes par période et du passMark de l'école.
 *
 * Les seuils sont proportionnels à l'échelle :
 * - CRITIQUE : moyenne < passMark × 0.75
 * - FAIBLE   : passMark × 0.75 ≤ moyenne < passMark
 * - ACQUIS   : passMark ≤ moyenne < passMark × 1.4
 * - FORCE    : moyenne ≥ passMark × 1.4
 *
 * Tendance : dernière période − première période ; ≥ +1 → HAUSSE, ≤ −1 → BAISSE, sinon STABLE.
 */

export type ClassificationMatiere = 'FORCE' | 'ACQUIS' | 'FAIBLE' | 'CRITIQUE';
export type Tendance = 'HAUSSE' | 'STABLE' | 'BAISSE';

export interface ClassificationResult {
  moyenneAnnuelle: number;
  classification: ClassificationMatiere;
  tendance: Tendance;
}

/**
 * Classe une matière en fonction de ses moyennes par période et du passMark.
 * Moyennes de 0 ou undefined sont ignorées (non comptées).
 */
export function classifierMatiere(
  moyennesParPeriode: number[],
  passMark: number,
): ClassificationResult {
  const valeurs = moyennesParPeriode.filter((m) => m > 0);
  const moyenneAnnuelle = valeurs.length > 0
    ? valeurs.reduce((s, m) => s + m, 0) / valeurs.length
    : 0;

  let classification: ClassificationMatiere;
  if (moyenneAnnuelle < passMark * 0.75) {
    classification = 'CRITIQUE';
  } else if (moyenneAnnuelle < passMark) {
    classification = 'FAIBLE';
  } else if (moyenneAnnuelle < passMark * 1.4) {
    classification = 'ACQUIS';
  } else {
    classification = 'FORCE';
  }

  const premiere = valeurs[0] ?? 0;
  const derniere = valeurs[valeurs.length - 1] ?? 0;
  const diff = derniere - premiere;
  let tendance: Tendance;
  if (diff >= 1) {
    tendance = 'HAUSSE';
  } else if (diff <= -1) {
    tendance = 'BAISSE';
  } else {
    tendance = 'STABLE';
  }

  return { moyenneAnnuelle, classification, tendance };
}
