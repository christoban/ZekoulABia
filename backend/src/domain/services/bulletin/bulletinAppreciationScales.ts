/**
 * DOMAIN LAYER — Échelles configurables de cotes (A+/A/ECA/NA) et de niveaux de compétence.
 *
 * Aucun seuil n'est codé en dur dans les renderers : chaque spec ou politique d'établissement
 * fournit ses propres bornes, avec deux jeux de valeurs par défaut documentés sur bulletins réels :
 * - Collège Le Québécois (Famille A, Primaire F, E) : NA < 10, ECA 10–14,99, A 15–17,99, A+ >= 18
 * - Garoua / Djamboutou (Familles B, C, D) : Non acquise < 11, En cours 11–13,99, Acquise 14–17,99, Expert >= 18
 */
import type {
  BulletinAppreciationScaleConfig,
  CompetenceScaleThresholds,
  CoteScaleThresholds,
} from '@domain/types/bulletinTemplateSpec';

export const DEFAULT_QUEBECOIS_COTE_SCALE: Readonly<CoteScaleThresholds> = Object.freeze({
  ongoingMin: 10,
  acquiredMin: 15,
  expertMin: 18,
});

export const DEFAULT_GAROUA_COMPETENCE_SCALE: Readonly<CompetenceScaleThresholds> = Object.freeze({
  ongoingMin: 11,
  acquiredMin: 14,
  expertMin: 18,
});

export const DEFAULT_GAROUA_COTE_SCALE: Readonly<CoteScaleThresholds> = Object.freeze({
  ongoingMin: 11,
  acquiredMin: 14,
  expertMin: 18,
});

export type CompetenceLevelCode = 'EXPERT' | 'ACQUIRED' | 'ONGOING' | 'NOT_ACQUIRED';

export function resolveEffectiveCoteScale(
  policyScale?: BulletinAppreciationScaleConfig,
  specScale?: BulletinAppreciationScaleConfig,
): CoteScaleThresholds {
  const src = policyScale?.cote ?? specScale?.cote;
  if (!src) return DEFAULT_QUEBECOIS_COTE_SCALE;
  return {
    ongoingMin: src.ongoingMin,
    acquiredMin: src.acquiredMin,
    expertMin: src.expertMin,
  };
}

export function resolveEffectiveCompetenceScale(
  policyScale?: BulletinAppreciationScaleConfig,
  specScale?: BulletinAppreciationScaleConfig,
): CompetenceScaleThresholds {
  const src = policyScale?.competence ?? specScale?.competence;
  if (!src) return DEFAULT_GAROUA_COMPETENCE_SCALE;
  return {
    ongoingMin: src.ongoingMin,
    acquiredMin: src.acquiredMin,
    expertMin: src.expertMin,
  };
}

export function evaluateCoteFromScale(
  average: number,
  thresholds: CoteScaleThresholds = DEFAULT_QUEBECOIS_COTE_SCALE,
): 'A+' | 'A' | 'ECA' | 'NA' {
  if (average >= thresholds.expertMin) return 'A+';
  if (average >= thresholds.acquiredMin) return 'A';
  if (average >= thresholds.ongoingMin) return 'ECA';
  return 'NA';
}

export function evaluateCompetenceCodeFromScale(
  average: number,
  thresholds: CompetenceScaleThresholds = DEFAULT_GAROUA_COMPETENCE_SCALE,
): CompetenceLevelCode {
  if (average >= thresholds.expertMin) return 'EXPERT';
  if (average >= thresholds.acquiredMin) return 'ACQUIRED';
  if (average >= thresholds.ongoingMin) return 'ONGOING';
  return 'NOT_ACQUIRED';
}

export function formatCompetenceLevelLabel(
  average: number,
  thresholds: CompetenceScaleThresholds = DEFAULT_GAROUA_COMPETENCE_SCALE,
  mode: 'fr' | 'en' | 'bilingual' = 'bilingual',
): string {
  const code = evaluateCompetenceCodeFromScale(average, thresholds);
  if (mode === 'fr') {
    switch (code) {
      case 'EXPERT': return 'Compétence expert';
      case 'ACQUIRED': return 'Compétence acquise';
      case 'ONGOING': return "En cours d'acquisition";
      case 'NOT_ACQUIRED': return 'Compétence non acquise';
    }
  }
  if (mode === 'en') {
    switch (code) {
      case 'EXPERT': return 'Expert';
      case 'ACQUIRED': return 'Acquired';
      case 'ONGOING': return 'In course of acquisition';
      case 'NOT_ACQUIRED': return 'Not acquired';
    }
  }
  switch (code) {
    case 'EXPERT': return 'Niveau Expert / High Profile';
    case 'ACQUIRED': return 'Compétence Acquise / Acquired';
    case 'ONGOING': return "En cours d'acquisition / Ongoing";
    case 'NOT_ACQUIRED': return 'Non acquise / Not Acquired';
  }
}

function formatBound(value: number, isEn: boolean): string {
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2);
  return isEn ? text : text.replace('.', ',');
}

function formatUpperBound(nextMin: number, isEn: boolean): string {
  const upper = Math.round((nextMin - 0.01) * 100) / 100;
  return isEn ? upper.toFixed(2) : upper.toFixed(2).replace('.', ',');
}

export function buildCoteLegendText(
  isEn: boolean,
  thresholds: CoteScaleThresholds = DEFAULT_QUEBECOIS_COTE_SCALE,
): string {
  const exp = formatBound(thresholds.expertMin, isEn);
  const acq = formatBound(thresholds.acquiredMin, isEn);
  const acqHi = formatUpperBound(thresholds.expertMin, isEn);
  const ong = formatBound(thresholds.ongoingMin, isEn);
  const ongHi = formatUpperBound(thresholds.acquiredMin, isEn);
  return `A+ [${exp}-20] • A [${acq}-${acqHi}] • ECA [${ong}-${ongHi}] • NA [<${ong}]`;
}

export function buildCoteLegendLines(
  isEn: boolean,
  thresholds: CoteScaleThresholds = DEFAULT_QUEBECOIS_COTE_SCALE,
): string {
  const exp = formatBound(thresholds.expertMin, isEn);
  const acq = formatBound(thresholds.acquiredMin, isEn);
  const acqHi = formatUpperBound(thresholds.expertMin, isEn);
  const ong = formatBound(thresholds.ongoingMin, isEn);
  const ongHi = formatUpperBound(thresholds.acquiredMin, isEn);
  const naHi = formatUpperBound(thresholds.ongoingMin, isEn);
  if (isEn) {
    return [
      `A+ : Expert [${exp}-20]`,
      `A : Acquired [${acq}-${acqHi}]`,
      `ECA : In course of acquisition [${ong}-${ongHi}]`,
      `NA : Not Acquired [0-${naHi}]`,
    ].join('\n');
  }
  return [
    `A+ : Expert [${exp}-20]`,
    `A : Acquis [${acq}-${acqHi}]`,
    `ECA : En cours d'acquisition [${ong}-${ongHi}]`,
    `NA : Non acquis [0-${naHi}]`,
  ].join('\n');
}

export function buildCompetenceLegendText(
  isEn: boolean,
  thresholds: CompetenceScaleThresholds = DEFAULT_GAROUA_COMPETENCE_SCALE,
): string {
  const exp = formatBound(thresholds.expertMin, isEn);
  const acq = formatBound(thresholds.acquiredMin, isEn);
  const acqHi = formatUpperBound(thresholds.expertMin, isEn);
  const ong = formatBound(thresholds.ongoingMin, isEn);
  const ongHi = formatUpperBound(thresholds.acquiredMin, isEn);
  if (isEn) {
    return `Expert [${exp}-20] • Acquired [${acq}-${acqHi}] • Ongoing [${ong}-${ongHi}] • Not acquired [<${ong}]`;
  }
  return `Expert [${exp}-20] • Acquise [${acq}-${acqHi}] • En cours [${ong}-${ongHi}] • Non acquise [<${ong}]`;
}

