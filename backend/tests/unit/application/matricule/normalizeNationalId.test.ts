import { describe, expect, it } from 'bun:test';
import { detectPotentialNationalIdDuplicates } from '../../../../src/application/matricule/detectPotentialNationalIdDuplicates.ts';
import { normalizeNationalId, validateNationalId } from '../../../../src/application/matricule/normalizeNationalId.ts';

describe('normalizeNationalId', () => {
  it('normalise le matricule MINESEC réel fourni', () => {
    expect(normalizeNationalId('250085010')).toBe('250085010');
  });

  it('supprime les espaces et met en majuscules sans imposer un format MINESEC', () => {
    expect(validateNationalId('  ab 12 09 ')).toBe('AB1209');
  });

  it('refuse une valeur vide ou non alphanumérique', () => {
    expect(() => validateNationalId('   ')).toThrow();
    expect(() => validateNationalId('2500-85010')).toThrow();
  });
});

describe('detectPotentialNationalIdDuplicates', () => {
  it('signale les doublons exacts normalisés sans fusionner les profils', () => {
    const report = detectPotentialNationalIdDuplicates([
      { profileId: 'a', schoolId: 'school-a', matricule: '250 085 010' },
      { profileId: 'b', schoolId: 'school-b', matricule: '250085010' },
    ]);

    expect(report.exactDuplicates).toHaveLength(1);
    expect(report.exactDuplicates[0].rows.map((row) => row.profileId)).toEqual(['a', 'b']);
  });

  it('signale les variantes confusables O/0 et I/1 comme alerte distincte', () => {
    const report = detectPotentialNationalIdDuplicates([
      { profileId: 'a', schoolId: 'school-a', matricule: '25O08501I' },
      { profileId: 'b', schoolId: 'school-b', matricule: '250085011' },
    ]);

    expect(report.exactDuplicates).toHaveLength(0);
    expect(report.confusableVariants).toHaveLength(1);
  });
});
