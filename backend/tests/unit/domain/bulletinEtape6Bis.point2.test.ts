import { describe, it, expect } from 'bun:test';
import PDFDocument from 'pdfkit';
import {
  DEFAULT_GAROUA_COMPETENCE_SCALE,
  DEFAULT_QUEBECOIS_COTE_SCALE,
  buildCompetenceLegendText,
  buildCoteLegendLines,
  buildCoteLegendText,
  evaluateCompetenceCodeFromScale,
  evaluateCoteFromScale,
  formatCompetenceLevelLabel,
} from '@domain/services/bulletin/bulletinAppreciationScales';
import {
  BILINGUAL_APC_V1,
  GENERAL_GROUPED_V1,
  PRIMARY_POINTS_RATIO_EN_V1,
  TECH_GROUPED_V1,
} from '@domain/templates/bulletinCatalog';
import type { SubjectTableBlockSpec } from '@domain/types/bulletinTemplateSpec';
import { buildFictitiousPreviewSnapshot } from '@application/reportCard/bulletinAtelierPreview';
import { MeasuredPdfKitBulletinRenderer } from '@infrastructure/pdf/renderer/MeasuredPdfKitBulletinRenderer';
import { buildDynamicFormulaHint } from '@infrastructure/pdf/renderer/measuredFormatHelpers';

function getTableScale(spec: { blocks: readonly { type: string; scaleConfig?: SubjectTableBlockSpec['scaleConfig'] }[] }) {
  return spec.blocks.find((b): b is SubjectTableBlockSpec => b.type === 'subjectTable')?.scaleConfig;
}

describe('Étape 6 bis — Point 2 : échelles configurables de cotes et niveaux de compétence + légende dynamique', () => {
  it('Famille A (3ème Le Québécois : NA < 10, ECA 10–14,99, A 15–17,99, A+ >= 18) classe les 8 valeurs réelles exactement', () => {
    const scaleA = getTableScale(GENERAL_GROUPED_V1)?.cote;
    expect(scaleA).toEqual(DEFAULT_QUEBECOIS_COTE_SCALE);

    const cases: Array<[number, 'A+' | 'A' | 'ECA' | 'NA']> = [
      [9.90, 'NA'],
      [10.30, 'ECA'],
      [10.50, 'ECA'],
      [10.90, 'ECA'],
      [11.00, 'ECA'],
      [13.00, 'ECA'],
      [14.00, 'ECA'],
      [18.50, 'A+'],
    ];
    for (const [val, expected] of cases) {
      expect(evaluateCoteFromScale(val, scaleA)).toBe(expected);
    }
    expect(evaluateCoteFromScale(15.00, scaleA)).toBe('A');
    expect(evaluateCoteFromScale(17.99, scaleA)).toBe('A');
    expect(evaluateCoteFromScale(18.00, scaleA)).toBe('A+');
  });

  it('Garoua & Djamboutou (Familles B, C, D : non acquise < 11, en cours 11–13,99, acquise 14–17,99, expert >= 18) classe les 8 valeurs réelles exactement', () => {
    const scaleB = getTableScale(TECH_GROUPED_V1)?.competence;
    const scaleC = getTableScale(BILINGUAL_APC_V1)?.competence;
    expect(scaleB).toEqual(DEFAULT_GAROUA_COMPETENCE_SCALE);
    expect(scaleC).toEqual(DEFAULT_GAROUA_COMPETENCE_SCALE);

    const cases: Array<[number, 'NOT_ACQUIRED' | 'ONGOING' | 'ACQUIRED' | 'EXPERT']> = [
      [9.90, 'NOT_ACQUIRED'],
      [10.30, 'NOT_ACQUIRED'],
      [10.50, 'NOT_ACQUIRED'],
      [10.90, 'NOT_ACQUIRED'],
      [11.00, 'ONGOING'],
      [13.00, 'ONGOING'],
      [14.00, 'ACQUIRED'],
      [18.50, 'EXPERT'],
    ];
    for (const [val, expected] of cases) {
      expect(evaluateCompetenceCodeFromScale(val, scaleB)).toBe(expected);
    }
    expect(formatCompetenceLevelLabel(10.90, scaleB, 'fr')).toBe('Compétence non acquise');
    expect(formatCompetenceLevelLabel(11.00, scaleB, 'fr')).toBe("En cours d'acquisition");
    expect(formatCompetenceLevelLabel(14.00, scaleB, 'fr')).toBe('Compétence acquise');
    expect(formatCompetenceLevelLabel(18.50, scaleB, 'fr')).toBe('Compétence expert');
  });

  it('génère dynamiquement les légendes imprimées à partir des seuils configurés (spec ou politique école)', async () => {
    expect(buildCoteLegendText(false, { ongoingMin: 10, acquiredMin: 15, expertMin: 18 }))
      .toBe('A+ [18-20] • A [15-17,99] • ECA [10-14,99] • NA [<10]');
    expect(buildCoteLegendText(true, { ongoingMin: 12, acquiredMin: 16, expertMin: 19 }))
      .toBe('A+ [19-20] • A [16-18.99] • ECA [12-15.99] • NA [<12]');
    expect(buildCoteLegendLines(false, { ongoingMin: 10, acquiredMin: 15, expertMin: 18 }))
      .toContain('NA : Non acquis [0-9,99]');
    expect(buildCompetenceLegendText(false, DEFAULT_GAROUA_COMPETENCE_SCALE))
      .toBe('Expert [18-20] • Acquise [14-17,99] • En cours [11-13,99] • Non acquise [<11]');

    const customPolicyHint = buildDynamicFormulaHint(
      { mode: 'single', scaleConfig: { cote: { ongoingMin: 12, acquiredMin: 16, expertMin: 19 } } },
      false,
      'A+/A/ECA/NA',
      getTableScale(GENERAL_GROUPED_V1),
    );
    expect(customPolicyHint).toContain('ECA [12-15,99]');
    expect(customPolicyHint).toContain('NA [<12]');

    // Vérification sur PDF réel (Famille F avec politique d'école surchargée)
    const renderer = new MeasuredPdfKitBulletinRenderer();
    const preview = buildFictitiousPreviewSnapshot(PRIMARY_POINTS_RATIO_EN_V1);
    const texts: string[] = [];
    const origText = PDFDocument.prototype.text;
    PDFDocument.prototype.text = function patched(this: PDFKit.PDFDocument, t: string, ...rest: unknown[]) {
      if (typeof t === 'string') texts.push(t);
      return (origText as (...a: unknown[]) => PDFKit.PDFDocument).call(this, t, ...rest);
    } as typeof PDFDocument.prototype.text;
    try {
      await renderer.render(preview.snapshot, PRIMARY_POINTS_RATIO_EN_V1, {
        className: 'Class V',
        periodName: 'Month 2',
        yearName: '2026-2027',
        mention: 'Good',
        language: 'en',
        gradingPolicy: { mode: 'single', scaleConfig: { cote: { ongoingMin: 12, acquiredMin: 16, expertMin: 19 } } },
        school: { schoolName: 'GSB Test', city: 'Yaoundé' },
      });
    } finally {
      PDFDocument.prototype.text = origText;
    }
    const joined = texts.join('\n');
    expect(joined).toContain('A+ : Expert [19-20]');
    expect(joined).toContain('ECA : In course of acquisition [12-15.99]');
    expect(joined).toContain('NA : Not Acquired [0-11.99]');
  });
});

