import type { BulletinGradingPolicy, BulletinRenderOptions } from '@domain/ports/services/BulletinRendererPort';
import type { StudentBulletinSnapshot } from '@domain/types/bulletinSnapshot';
import type {
  BulletinAppreciationScaleConfig,
  CoteScaleThresholds,
  PeriodLabelMode,
  SubjectTableBlockSpec,
} from '@domain/types/bulletinTemplateSpec';
import {
  buildCompetenceLegendText,
  buildCoteLegendText,
  resolveEffectiveCompetenceScale,
  resolveEffectiveCoteScale,
} from '@domain/services/bulletin/bulletinAppreciationScales';

export function formatLocalizedNumber(
  value: number | null | undefined,
  isEn: boolean,
  decimals = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const raw = value.toFixed(decimals);
  return isEn ? raw : raw.replace('.', ',');
}

export function formatLocalizedPercent(
  value: number | null | undefined,
  isEn: boolean,
  decimals = 2,
): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  const formatted = formatLocalizedNumber(value, isEn, decimals);
  return isEn ? `${formatted}%` : `${formatted} %`;
}

export function formatCoteLegend(isEn: boolean, thresholds?: CoteScaleThresholds): string {
  return buildCoteLegendText(isEn, thresholds);
}

function formatWeight(value: number, isEn: boolean): string {
  if (Number.isInteger(value)) return String(value);
  return formatLocalizedNumber(value, isEn, 1);
}

export function buildDynamicFormulaHint(
  policy: BulletinGradingPolicy | undefined,
  isEn: boolean,
  appreciationScale: SubjectTableBlockSpec['appreciationScale'],
  specScaleConfig?: BulletinAppreciationScaleConfig,
): string {
  const mode = (policy?.mode ?? 'single').toLowerCase();
  let rule: string;

  if (mode === 'weighted') {
    const rawCc = policy?.classTestWeight ?? 30;
    const rawDs = policy?.terminalExamWeight ?? 70;
    const total = rawCc + rawDs > 0 ? rawCc + rawDs : 100;
    const ccPct = Math.round((rawCc / total) * 10000) / 100;
    const dsPct = Math.round((rawDs / total) * 10000) / 100;
    const ccLabel = `${formatWeight(ccPct, isEn)}${isEn ? '%' : ' %'}`;
    const dsLabel = `${formatWeight(dsPct, isEn)}${isEn ? '%' : ' %'}`;
    rule = isEn
      ? `Formula: AVG/20 = CA ${ccLabel} + EX ${dsLabel}`
      : `Règle de calcul : EVA/20 = CC ${ccLabel} + DS ${dsLabel}`;
  } else if (mode === 'triple') {
    const w1 = policy?.ds1Weight ?? 1;
    const w2 = policy?.ds2Weight ?? 1;
    const wc = policy?.compositionWeight ?? 2;
    const denom = w1 + w2 + wc > 0 ? w1 + w2 + wc : 4;
    rule = isEn
      ? `Formula: AVG/20 = (T1 × ${formatWeight(w1, true)} + T2 × ${formatWeight(w2, true)} + Exam × ${formatWeight(wc, true)}) / ${formatWeight(denom, true)}`
      : `Règle de calcul : EVA/20 = (DS1 × ${formatWeight(w1, false)} + DS2 × ${formatWeight(w2, false)} + Comp × ${formatWeight(wc, false)}) / ${formatWeight(denom, false)}`;
  } else {
    rule = isEn
      ? 'Formula: AVG/20 = simple average of assessments (CA/EX)'
      : 'Règle de calcul : EVA/20 = moyenne simple des évaluations (CC/DS)';
  }

  if (appreciationScale === 'A+/A/ECA/NA') {
    const coteScale = resolveEffectiveCoteScale(policy?.scaleConfig, specScaleConfig);
    return isEn
      ? `${rule}   |   Grades: ${formatCoteLegend(true, coteScale)}`
      : `${rule}   |   Cotes : ${formatCoteLegend(false, coteScale)}`;
  }
  if (appreciationScale === 'APC_TEXT' || specScaleConfig?.competence || policy?.scaleConfig?.competence) {
    const compScale = resolveEffectiveCompetenceScale(policy?.scaleConfig, specScaleConfig);
    return isEn
      ? `${rule}   |   Skills: ${buildCompetenceLegendText(true, compScale)}`
      : `${rule}   |   Compétences : ${buildCompetenceLegendText(false, compScale)}`;
  }
  return rule;
}

export function formatPeriodBannerTitle(
  periodName: string,
  yearName: string,
  isEn: boolean,
  mode?: PeriodLabelMode,
  isAnnual?: boolean,
): string {
  if (isAnnual || mode === 'ANNUAL') {
    return isEn
      ? `ANNUAL REPORT CARD — ${yearName}`
      : `BULLETIN ANNUEL — ${yearName}`;
  }

  const trimmed = periodName.trim();
  const numMatch = /\b(\d+)\b/.exec(trimmed);
  let displayPeriod = trimmed;

  if (mode === 'EVALUATION') {
    if (isEn) {
      displayPeriod = numMatch ? `Evaluation ${numMatch[1]}` : (/eval/i.test(trimmed) ? trimmed : `Evaluation — ${trimmed}`);
    } else {
      displayPeriod = numMatch ? `Évaluation ${numMatch[1]}` : (/eval|éval/i.test(trimmed) ? trimmed : `Évaluation — ${trimmed}`);
    }
  } else if (mode === 'SEQUENCE') {
    if (isEn) {
      displayPeriod = numMatch ? `Sequence ${numMatch[1]}` : (/seq/i.test(trimmed) ? trimmed : `Sequence — ${trimmed}`);
    } else {
      displayPeriod = numMatch ? `Séquence ${numMatch[1]}` : (/séqu|sequ/i.test(trimmed) ? trimmed : `Séquence — ${trimmed}`);
    }
  } else if (mode === 'TRIMESTER') {
    if (isEn) {
      displayPeriod = numMatch ? `Trimester ${numMatch[1]}` : (/trim/i.test(trimmed) ? trimmed : `Trimester — ${trimmed}`);
    } else {
      displayPeriod = numMatch ? `Trimestre ${numMatch[1]}` : (/trim/i.test(trimmed) ? trimmed : `Trimestre — ${trimmed}`);
    }
  } else if (mode === 'TERM') {
    if (isEn) {
      displayPeriod = numMatch ? `Term ${numMatch[1]}` : (/term/i.test(trimmed) ? trimmed : `Term — ${trimmed}`);
    } else {
      displayPeriod = numMatch ? `Trimestre ${numMatch[1]}` : trimmed;
    }
  } else if (mode === 'MONTHLY') {
    displayPeriod = isEn ? `Monthly — ${trimmed}` : `Mensuel — ${trimmed}`;
  }

  const prefix = isEn ? 'REPORT CARD' : 'BULLETIN SCOLAIRE';
  return `${prefix} — ${displayPeriod} (${yearName})`;
}

function normalizeEvalLabel(raw: string | undefined, isEn: boolean): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const numMatch = /(\d+)/.exec(trimmed);
  if (numMatch && /eval|éval|seq|séqu|test/i.test(trimmed)) {
    return isEn ? `Eval ${numMatch[1]}` : `Éval ${numMatch[1]}`;
  }
  return trimmed;
}

/**
 * Résout les vrais libellés numérotés des 2 évaluations de la période :
 * - priorité 1 : options.seq1Label / options.seq2Label explicites ;
 * - priorité 2 : noms des séquences présentes dans snapshot.sequenceAverages ;
 * - priorité 3 : numéro de trimestre/term extrait de options.periodName
 *   (T1 → Éval 1 & Éval 2, T2 → Éval 3 & Éval 4, T3 → Éval 5 & Éval 6).
 */
export function resolvePeriodEvaluationLabels(
  snapshot: StudentBulletinSnapshot,
  options: Pick<BulletinRenderOptions, 'periodName' | 'seq1Label' | 'seq2Label'> | undefined,
  isEn: boolean,
): [string, string] {
  const prefix = isEn ? 'Eval' : 'Éval';
  const opt1 = normalizeEvalLabel(options?.seq1Label, isEn);
  const opt2 = normalizeEvalLabel(options?.seq2Label, isEn);
  if (opt1 && opt2) return [opt1, opt2];

  const seqs = snapshot.sequenceAverages ?? [];
  const snap1 = normalizeEvalLabel(seqs[0]?.name, isEn);
  const snap2 = normalizeEvalLabel(seqs[1]?.name, isEn);
  if (snap1 && snap2) return [opt1 ?? snap1, opt2 ?? snap2];
  if (snap1) {
    const nMatch = /(\d+)/.exec(snap1);
    const nextLabel = nMatch ? `${prefix} ${Number(nMatch[1]) + 1}` : `${prefix} 2`;
    return [opt1 ?? snap1, opt2 ?? nextLabel];
  }

  const period = options?.periodName ?? '';
  const termMatch = /(?:trim(?:estre)?|term|t)\s*\.?\s*([123])\b|\b([123])(?:er|e|ème|st|nd|rd)\s*(?:trim|term)/i.exec(period);
  const termNum = termMatch ? Number(termMatch[1] ?? termMatch[2]) : 1;
  const firstNum = termNum === 2 ? 3 : termNum === 3 ? 5 : 1;
  return [
    opt1 ?? `${prefix} ${firstNum}`,
    opt2 ?? `${prefix} ${firstNum + 1}`,
  ];
}

