import { describe, it, expect } from 'bun:test';
import PDFDocument from 'pdfkit';
import {
  ANNUAL_BILINGUAL_V1,
  BILINGUAL_APC_V1,
  TECH_GROUPED_V1,
} from '@domain/templates/bulletinCatalog';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import { resolvePeriodEvaluationLabels } from '@infrastructure/pdf/renderer/measuredFormatHelpers';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';

async function captureRenderedTexts(
  spec: typeof BILINGUAL_APC_V1,
  periodName: string,
  seqLabels?: { seq1Label?: string; seq2Label?: string },
): Promise<string[]> {
  const preview = buildFictitiousPreviewSnapshot(spec);
  // Simuler un snapshot sans noms de séquence pour tester le repli par numéro de période si besoin
  const renderer = new MeasuredPdfKitBulletinRenderer();
  const texts: string[] = [];
  const origText = PDFDocument.prototype.text;
  PDFDocument.prototype.text = function patched(this: PDFKit.PDFDocument, t: string, ...rest: unknown[]) {
    if (typeof t === 'string') texts.push(t);
    return (origText as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, ...rest);
  } as typeof PDFDocument.prototype.text;
  try {
    await renderer.render(preview.snapshot, spec, {
      className: preview.className,
      periodName,
      yearName: preview.yearName,
      isAnnual: spec.familyKey === 'D',
      mention: preview.mention,
      language: 'fr',
      seq1Label: seqLabels?.seq1Label,
      seq2Label: seqLabels?.seq2Label,
      school: { schoolName: 'Lycée Bilingue Test', city: 'Garoua' },
    });
  } finally {
    PDFDocument.prototype.text = origText;
  }
  return texts;
}

describe('Étape 6 bis — Point 4 : libellés de groupes purs et numéros réels d’évaluations selon la période', () => {
  it('résout les vrais numéros d’évaluations selon la période (T1→Éval 1/2, T2→Éval 3/4, T3→Éval 5/6) sans jamais produire Eval a / Eval b', () => {
    const emptySnap = buildFictitiousPreviewSnapshot(BILINGUAL_APC_V1).snapshot;
    const withoutSeqs = { ...emptySnap, sequenceAverages: undefined };

    expect(resolvePeriodEvaluationLabels(withoutSeqs, { periodName: 'Trimestre 1' }, false)).toEqual(['Éval 1', 'Éval 2']);
    expect(resolvePeriodEvaluationLabels(withoutSeqs, { periodName: '2e Trimestre' }, false)).toEqual(['Éval 3', 'Éval 4']);
    expect(resolvePeriodEvaluationLabels(withoutSeqs, { periodName: 'Trimestre 3' }, false)).toEqual(['Éval 5', 'Éval 6']);
    expect(resolvePeriodEvaluationLabels(withoutSeqs, { periodName: 'Term 2' }, true)).toEqual(['Eval 3', 'Eval 4']);

    // Priorité aux séquences réelles du snapshot (ex. Évaluation 3 & Évaluation 4)
    expect(resolvePeriodEvaluationLabels(emptySnap, { periodName: 'Trimestre 2' }, false)).toEqual(['Éval 3', 'Éval 4']);
  });

  it('Famille C (2e trimestre) affiche Éval 3 et Éval 4, jamais Eval a / Eval b, et des groupes purs sans double parenthèse', async () => {
    const texts = await captureRenderedTexts(BILINGUAL_APC_V1, 'Trimestre 2');
    const joined = texts.join('\n');

    expect(joined).toContain('Éval 3');
    expect(joined).toContain('Éval 4');
    expect(joined).not.toContain('Eval a');
    expect(joined).not.toContain('Eval b');
    expect(joined).not.toContain('((');
    expect(joined).not.toContain('))');
    expect(joined).not.toContain('Littéraire');
    expect(joined).not.toContain('Scientifique');
    expect(joined).toContain('1ER GROUPE');
    expect(joined).toContain('2E GROUPE');
    expect(joined).toContain('3E GROUPE');
  });

  it('Famille D et Famille B affichent uniquement les libellés configurés et les numéros réels d’évaluations', async () => {
    const textsD = await captureRenderedTexts(ANNUAL_BILINGUAL_V1, 'Annuel');
    const joinedD = textsD.join('\n');
    expect(joinedD).toContain('Éval 1');
    expect(joinedD).toContain('Éval 6');
    expect(joinedD).not.toContain('((');
    expect(joinedD).not.toContain('))');
    expect(joinedD).not.toContain('Littéraire');

    const textsB = await captureRenderedTexts(TECH_GROUPED_V1, 'Trimestre 2', { seq1Label: 'Éval 3', seq2Label: 'Éval 4' });
    const joinedB = textsB.join('\n');
    expect(joinedB).toContain('Éval 3');
    expect(joinedB).toContain('Éval 4');
    expect(joinedB).not.toContain('Eval a');
    expect(joinedB).not.toContain('Eval b');
  });
});

