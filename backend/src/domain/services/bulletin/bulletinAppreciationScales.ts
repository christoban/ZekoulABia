/**
 * DOMAIN LAYER — Échelles configurables de cotes (A+/A/ECA/NA) et de niveaux de compétence.
 *
 * Chaque borne supporte l'inclusif (`>=`, défaut) et l'exclusif (`>`, `*Inclusive: false`).
 * Valeurs par défaut documentées sur bulletins réels :
 * - Famille A (Collège Le Québécois 3ème) : NA < 10 (À CONFIRMER SUR LE TERRAIN), ECA [10–14,99], A [15–17,99], A+ >= 18
 * - Famille F (Primaire GSB Le Québécois) : NA [0 ; 10] inclus (`ongoingInclusive: false`, preuve : 35/70 et 5/10 = 10,00 notés NA),
 *   ECA ]10 ; 14,99], A [15 ; 17,99], A+ >= 18
 * - Garoua / Djamboutou (Familles B, C, D) : Non acquise < 11, En cours 11–13,99, Acquise 14–17,99, Expert >= 18
 */
import type {
  BulletinAppreciationScaleConfig,
  CompetenceScaleThresholds,
  CoteScaleThresholds,
} from '@domain/types/bulletinTemplateSpec';

// À CONFIRMER SUR LE TERRAIN : borne NA < 10 (ongoingInclusive: true) conservée sur Famille A jusqu'à validation terrain.
export const DEFAULT_QUEBECOIS_COTE_SCALE: Readonly<CoteScaleThresholds> = Object.freeze({
  ongoingMin: 10,
  ongoingInclusive: true,
  acquiredMin: 15,
  acquiredInclusive: true,
  expertMin: 18,
  expertInclusive: true,
});

export const DEFAULT_PRIMARY_COTE_SCALE: Readonly<CoteScaleThresholds> = Object.freeze({
  ongoingMin: 10,
  ongoingInclusive: false,
  acquiredMin: 15,
  acquiredInclusive: true,
  expertMin: 18,
  expertInclusive: true,
});

export const DEFAULT_GAROUA_COMPETENCE_SCALE: Readonly<CompetenceScaleThresholds> = Object.freeze({
  ongoingMin: 11,
  ongoingInclusive: true,
  acquiredMin: 14,
  acquiredInclusive: true,
  expertMin: 18,
  expertInclusive: true,
});

export const DEFAULT_GAROUA_COTE_SCALE: Readonly<CoteScaleThresholds> = Object.freeze({
  ongoingMin: 11,
  ongoingInclusive: true,
  acquiredMin: 14,
  acquiredInclusive: true,
  expertMin: 18,
  expertInclusive: true,
});

export type CompetenceLevelCode = 'EXPERT' | 'ACQUIRED' | 'ONGOING' | 'NOT_ACQUIRED';

function meetsLowerBound(value: number, min: number, inclusive = true): boolean {
  return inclusive ? value >= min : value > min;
}

export function resolveEffectiveCoteScale(
  policyScale?: BulletinAppreciationScaleConfig,
  specScale?: BulletinAppreciationScaleConfig,
): CoteScaleThresholds {
  const src = policyScale?.cote ?? specScale?.cote;
  if (!src) return DEFAULT_QUEBECOIS_COTE_SCALE;
  return {
    ongoingMin: src.ongoingMin,
    ongoingInclusive: src.ongoingInclusive ?? true,
    acquiredMin: src.acquiredMin,
    acquiredInclusive: src.acquiredInclusive ?? true,
    expertMin: src.expertMin,
    expertInclusive: src.expertInclusive ?? true,
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
    ongoingInclusive: src.ongoingInclusive ?? true,
    acquiredMin: src.acquiredMin,
    acquiredInclusive: src.acquiredInclusive ?? true,
    expertMin: src.expertMin,
    expertInclusive: src.expertInclusive ?? true,
  };
}

export function evaluateCoteFromScale(
  average: number,
  thresholds: CoteScaleThresholds = DEFAULT_QUEBECOIS_COTE_SCALE,
): 'A+' | 'A' | 'ECA' | 'NA' {
  if (meetsLowerBound(average, thresholds.expertMin, thresholds.expertInclusive)) return 'A+';
  if (meetsLowerBound(average, thresholds.acquiredMin, thresholds.acquiredInclusive)) return 'A';
  if (meetsLowerBound(average, thresholds.ongoingMin, thresholds.ongoingInclusive)) return 'ECA';
  return 'NA';
}

export function evaluateCompetenceCodeFromScale(
  average: number,
  thresholds: CompetenceScaleThresholds = DEFAULT_GAROUA_COMPETENCE_SCALE,
): CompetenceLevelCode {
  if (meetsLowerBound(average, thresholds.expertMin, thresholds.expertInclusive)) return 'EXPERT';
  if (meetsLowerBound(average, thresholds.acquiredMin, thresholds.acquiredInclusive)) return 'ACQUIRED';
  if (meetsLowerBound(average, thresholds.ongoingMin, thresholds.ongoingInclusive)) return 'ONGOING';
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

function formatBelowBound(nextMin: number, nextInclusive: boolean, isEn: boolean): string {
  if (!nextInclusive) return formatBound(nextMin, isEn);
  const upper = Math.round((nextMin - 0.01) * 100) / 100;
  return isEn ? upper.toFixed(2) : upper.toFixed(2).replace('.', ',');
}

function formatRange(
  min: number,
  minInclusive: boolean,
  upperText: string,
  isEn: boolean,
): string {
  const open = minInclusive ? '[' : ']';
  return `${open}${formatBound(min, isEn)}-${upperText}]`;
}

export function buildCoteLegendText(
  isEn: boolean,
  thresholds: CoteScaleThresholds = DEFAULT_QUEBECOIS_COTE_SCALE,
): string {
  const expInc = thresholds.expertInclusive ?? true;
  const acqInc = thresholds.acquiredInclusive ?? true;
  const ongInc = thresholds.ongoingInclusive ?? true;

  const expRange = formatRange(thresholds.expertMin, expInc, '20', isEn);
  const acqRange = formatRange(thresholds.acquiredMin, acqInc, formatBelowBound(thresholds.expertMin, expInc, isEn), isEn);
  const ongRange = formatRange(thresholds.ongoingMin, ongInc, formatBelowBound(thresholds.acquiredMin, acqInc, isEn), isEn);
  const naPart = ongInc ? `[<${formatBound(thresholds.ongoingMin, isEn)}]` : `[0-${formatBound(thresholds.ongoingMin, isEn)}]`;
  return `A+ ${expRange} • A ${acqRange} • ECA ${ongRange} • NA ${naPart}`;
}

export function buildCoteLegendLines(
  isEn: boolean,
  thresholds: CoteScaleThresholds = DEFAULT_QUEBECOIS_COTE_SCALE,
): string {
  const expInc = thresholds.expertInclusive ?? true;
  const acqInc = thresholds.acquiredInclusive ?? true;
  const ongInc = thresholds.ongoingInclusive ?? true;

  const expRange = formatRange(thresholds.expertMin, expInc, '20', isEn);
  const acqRange = formatRange(thresholds.acquiredMin, acqInc, formatBelowBound(thresholds.expertMin, expInc, isEn), isEn);
  const ongRange = formatRange(thresholds.ongoingMin, ongInc, formatBelowBound(thresholds.acquiredMin, acqInc, isEn), isEn);
  const naRange = `[0-${formatBelowBound(thresholds.ongoingMin, ongInc, isEn)}]`;

  if (isEn) {
    return [
      `A+ : Expert ${expRange}`,
      `A : Acquired ${acqRange}`,
      `ECA : In course of acquisition ${ongRange}`,
      `NA : Not Acquired ${naRange}`,
    ].join('\n');
  }
  return [
    `A+ : Expert ${expRange}`,
    `A : Acquis ${acqRange}`,
    `ECA : En cours d'acquisition ${ongRange}`,
    `NA : Non acquis ${naRange}`,
  ].join('\n');
}

export function buildCompetenceLegendText(
  isEn: boolean,
  thresholds: CompetenceScaleThresholds = DEFAULT_GAROUA_COMPETENCE_SCALE,
): string {
  const expInc = thresholds.expertInclusive ?? true;
  const acqInc = thresholds.acquiredInclusive ?? true;
  const ongInc = thresholds.ongoingInclusive ?? true;

  const expRange = formatRange(thresholds.expertMin, expInc, '20', isEn);
  const acqRange = formatRange(thresholds.acquiredMin, acqInc, formatBelowBound(thresholds.expertMin, expInc, isEn), isEn);
  const ongRange = formatRange(thresholds.ongoingMin, ongInc, formatBelowBound(thresholds.acquiredMin, acqInc, isEn), isEn);
  const naPart = ongInc ? `[<${formatBound(thresholds.ongoingMin, isEn)}]` : `[0-${formatBound(thresholds.ongoingMin, isEn)}]`;

  if (isEn) {
    return `Expert ${expRange} • Acquired ${acqRange} • Ongoing ${ongRange} • Not acquired ${naPart}`;
  }
  return `Expert ${expRange} • Acquise ${acqRange} • En cours ${ongRange} • Non acquise ${naPart}`;
}
