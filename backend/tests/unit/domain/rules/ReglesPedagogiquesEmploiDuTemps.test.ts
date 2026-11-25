import { describe, expect, it } from 'bun:test';
import { calculerCategorieJoursDistincts, exigeDeuxJours } from '../../../../src/domain/rules/ReglesPedagogiquesEmploiDuTemps.ts';

describe('Règles pédagogiques emploi du temps', () => {
  it('reconnaît Travail Manuel au singulier comme EPS_TM', () => {
    const categorie = calculerCategorieJoursDistincts('Travail Manuel');

    expect(categorie).toBe('EPS_TM');
    expect(exigeDeuxJours({ categorieJoursDistincts: categorie, nbOccurrencesHebdomadaires: 2 })).toBe(true);
  });
});
