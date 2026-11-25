import { describe, expect, it } from 'bun:test';
import { CandidateCodeGenerator } from '../CandidateCodeGenerator';

describe('CandidateCodeGenerator', () => {
  it('normalise correctement un code ou nom décole', () => {
    expect(CandidateCodeGenerator.normaliserCodeEtablissement('Collège Vogt')).toBe('COLLEG');
    expect(CandidateCodeGenerator.normaliserCodeEtablissement('EK')).toBe('EK');
    expect(CandidateCodeGenerator.normaliserCodeEtablissement('St. Joseph')).toBe('STJOSE');
    expect(CandidateCodeGenerator.normaliserCodeEtablissement('X')).toBe('EXAM');
  });

  it('génère un code candidat standardisé {CODE}-C{NUM}', () => {
    expect(CandidateCodeGenerator.genererCode('EK', 1)).toBe('EK-C001');
    expect(CandidateCodeGenerator.genererCode('EK', 42)).toBe('EK-C042');
    expect(CandidateCodeGenerator.genererCode('EK', 1234)).toBe('EK-C1234');
    expect(CandidateCodeGenerator.genererCode('Vogt', 7, 4)).toBe('VOGT-C0007');
  });

  it('rejette les numéros de séquence invalides', () => {
    expect(() => CandidateCodeGenerator.genererCode('EK', 0)).toThrow();
    expect(() => CandidateCodeGenerator.genererCode('EK', -5)).toThrow();
    expect(() => CandidateCodeGenerator.genererCode('EK', 1.5)).toThrow();
  });

  it('valide et extrait correctement les informations d un code', () => {
    expect(CandidateCodeGenerator.validerCode('EK-C042')).toBe(true);
    expect(CandidateCodeGenerator.validerCode('VOGT-C001')).toBe(true);
    expect(CandidateCodeGenerator.validerCode('C042')).toBe(false);
    expect(CandidateCodeGenerator.validerCode('EK-042')).toBe(false);
    expect(CandidateCodeGenerator.validerCode('')).toBe(false);

    const extrait = CandidateCodeGenerator.extraireCode('EK-C042');
    expect(extrait).toEqual({
      schoolCode: 'EK',
      sequenceNumber: 42,
    });

    expect(CandidateCodeGenerator.extraireCode('INVALIDE')).toBeNull();
  });
});
