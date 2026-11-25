import { describe, it, expect } from 'bun:test';
import {
  DEFAULT_PRIMARY_COTE_SCALE,
  DEFAULT_QUEBECOIS_COTE_SCALE,
  buildCoteLegendLines,
  buildCoteLegendText,
  evaluateCompetenceCodeFromScale,
  evaluateCoteFromScale,
} from '@domain/services/bulletin/bulletinAppreciationScales';
import {
  GENERAL_GROUPED_V1,
  PRIMARY_POINTS_RATIO_EN_V1,
  PRIMARY_POINTS_RATIO_FR_LABELS_V1,
} from '@domain/templates/bulletinCatalog';
import type { SubjectTableBlockSpec } from '@domain/types/bulletinTemplateSpec';

function getCoteScale(spec: typeof GENERAL_GROUPED_V1) {
  return spec.blocks.find((b): b is SubjectTableBlockSpec => b.type === 'subjectTable')?.scaleConfig?.cote;
}

describe('Étape 6 ter — Point 6 : bornes inclusives et exclusives (Primaire MINEDUB NA = [0;10] inclus, Secondaire MINESEC Famille A NA < 10)', () => {
  it('Famille F (Primaire EN & libellés FR) : NA = [0 ; 10] inclus (35/70, 5/10, 10/20 et 20/40 -> NA), ECA ]10 ; 14,99], A [15 ; 17,99], A+ >= 18', () => {
    for (const spec of [PRIMARY_POINTS_RATIO_EN_V1, PRIMARY_POINTS_RATIO_FR_LABELS_V1]) {
      const scale = getCoteScale(spec);
      expect(scale).toEqual(DEFAULT_PRIMARY_COTE_SCALE);
      expect(scale?.ongoingInclusive).toBe(false);

      expect(evaluateCoteFromScale(10.00, scale)).toBe('NA');
      expect(evaluateCoteFromScale(10.01, scale)).toBe('ECA');
      expect(evaluateCoteFromScale(10.66, scale)).toBe('ECA');
      expect(evaluateCoteFromScale(14.99, scale)).toBe('ECA');
      expect(evaluateCoteFromScale(15.00, scale)).toBe('A');
      expect(evaluateCoteFromScale(17.99, scale)).toBe('A');
      expect(evaluateCoteFromScale(18.00, scale)).toBe('A+');

      // Preuves bulletins primaires réels : GSB Le Québécois EN (35/70, 5/10) + CM2 MINEDUB FR (10/20, 20/40) = 10,00 -> NA
      expect(evaluateCoteFromScale((35 / 70) * 20, scale)).toBe('NA');
      expect(evaluateCoteFromScale((5 / 10) * 20, scale)).toBe('NA');
      expect(evaluateCoteFromScale((20 / 40) * 20, scale)).toBe('NA');
    }

    expect(buildCoteLegendText(true, DEFAULT_PRIMARY_COTE_SCALE))
      .toBe('A+ [18-20] • A [15-17.99] • ECA ]10-14.99] • NA [0-10]');
    expect(buildCoteLegendLines(true, DEFAULT_PRIMARY_COTE_SCALE))
      .toContain('NA : Not Acquired [0-10]');
    expect(buildCoteLegendLines(false, DEFAULT_PRIMARY_COTE_SCALE))
      .toContain("ECA : En cours d'acquisition ]10-14,99]");
    expect(buildCoteLegendLines(false, DEFAULT_PRIMARY_COTE_SCALE))
      .toContain('NA : Non acquis [0-10]');
  });

  it('Famille A (Secondaire MINESEC APC) : NA < 10 (9,90 -> NA, 10,00 et 10,30 -> ECA), A [15 ; 17,99], A+ >= 18', () => {
    const scaleA = getCoteScale(GENERAL_GROUPED_V1);
    expect(scaleA).toEqual(DEFAULT_QUEBECOIS_COTE_SCALE);
    expect(scaleA?.ongoingInclusive).toBe(true);

    expect(evaluateCoteFromScale(9.90, scaleA)).toBe('NA');
    expect(evaluateCoteFromScale(10.00, scaleA)).toBe('ECA');
    expect(evaluateCoteFromScale(10.30, scaleA)).toBe('ECA');
    expect(evaluateCoteFromScale(14.99, scaleA)).toBe('ECA');
    expect(evaluateCoteFromScale(15.00, scaleA)).toBe('A');
    expect(evaluateCoteFromScale(17.99, scaleA)).toBe('A');
    expect(evaluateCoteFromScale(18.00, scaleA)).toBe('A+');
  });

  it('supporte aussi les bornes exclusives sur les niveaux intermédiaires et supérieurs (cotes et compétences)', () => {
    const strictCote = { ongoingMin: 10, ongoingInclusive: false, acquiredMin: 15, acquiredInclusive: false, expertMin: 18, expertInclusive: false };
    expect(evaluateCoteFromScale(15.00, strictCote)).toBe('ECA');
    expect(evaluateCoteFromScale(15.01, strictCote)).toBe('A');
    expect(evaluateCoteFromScale(18.00, strictCote)).toBe('A');
    expect(evaluateCoteFromScale(18.01, strictCote)).toBe('A+');

    const strictComp = { ongoingMin: 11, ongoingInclusive: false, acquiredMin: 14, acquiredInclusive: false, expertMin: 18, expertInclusive: true };
    expect(evaluateCompetenceCodeFromScale(11.00, strictComp)).toBe('NOT_ACQUIRED');
    expect(evaluateCompetenceCodeFromScale(11.01, strictComp)).toBe('ONGOING');
    expect(evaluateCompetenceCodeFromScale(14.00, strictComp)).toBe('ONGOING');
    expect(evaluateCompetenceCodeFromScale(14.01, strictComp)).toBe('ACQUIRED');
  });
});

