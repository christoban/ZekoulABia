import { describe, it, expect } from 'bun:test';
import {
  ANNUAL_BILINGUAL_V1,
  BILINGUAL_APC_V1,
  EN_SECONDARY_V1,
  GENERAL_GROUPED_V1,
  PRIMARY_POINTS_RATIO_EN_V1,
  PRIMARY_POINTS_RATIO_FR_LABELS_V1,
  TECH_GROUPED_V1,
} from '@domain/templates/bulletinCatalog';
import {
  buildFictitiousPreviewSnapshot,
  computeFictitiousBirthDateForClass,
} from '@application/reportCard/bulletinAtelierPreview';

describe('Étape 6 ter — Point 3 : date de naissance fictive générée selon le niveau de classe et l’année scolaire', () => {
  it('dérive une année de naissance cohérente pour chaque niveau (primaire ~2015, 3ème ~2011, 2nde ~2010, 1ère ~2009, Tle ~2008)', () => {
    expect(computeFictitiousBirthDateForClass('Class V (Sample)', '2026-2027').slice(0, 4)).toBe('2015');
    expect(computeFictitiousBirthDateForClass('CM2 (Spécimen)', '2026-2027').slice(0, 4)).toBe('2015');
    expect(computeFictitiousBirthDateForClass('6ème A', '2026-2027').slice(0, 4)).toBe('2014');
    expect(computeFictitiousBirthDateForClass('3ème (Spécimen)', '2026-2027').slice(0, 4)).toBe('2011');
    expect(computeFictitiousBirthDateForClass('Form 4 Science (Sample)', '2026-2027').slice(0, 4)).toBe('2011');
    expect(computeFictitiousBirthDateForClass('2nde F3 (Spécimen)', '2026-2027').slice(0, 4)).toBe('2010');
    expect(computeFictitiousBirthDateForClass('1ère A4 (Spécimen)', '2026-2027').slice(0, 4)).toBe('2009');
    expect(computeFictitiousBirthDateForClass('Terminale C', '2026-2027').slice(0, 4)).toBe('2008');

    // S'adapte dynamiquement si l'année scolaire change (jamais figée)
    expect(computeFictitiousBirthDateForClass('CM2', '2028-2029').slice(0, 4)).toBe('2017');
    expect(computeFictitiousBirthDateForClass('3ème', '2028-2029').slice(0, 4)).toBe('2013');
  });

  it('les spécimens des familles A à F portent chacun une date de naissance cohérente avec leur classe fictive', () => {
    const dobYear = (spec: typeof GENERAL_GROUPED_V1) =>
      Number(buildFictitiousPreviewSnapshot(spec).snapshot.studentIdentity?.dateOfBirth?.slice(0, 4));

    expect(dobYear(PRIMARY_POINTS_RATIO_EN_V1)).toBe(2015);
    expect(dobYear(PRIMARY_POINTS_RATIO_FR_LABELS_V1)).toBe(2015);
    expect(dobYear(GENERAL_GROUPED_V1)).toBe(2011);
    expect(dobYear(EN_SECONDARY_V1)).toBe(2011);
    expect(dobYear(TECH_GROUPED_V1)).toBe(2010);
    expect(dobYear(BILINGUAL_APC_V1)).toBe(2010);
    expect(dobYear(ANNUAL_BILINGUAL_V1)).toBe(2009);
  });
});

