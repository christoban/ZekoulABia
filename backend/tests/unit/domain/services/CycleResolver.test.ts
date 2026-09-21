import { describe, it, expect } from 'bun:test';
import { CycleResolver } from '../../../../src/domain/services/CycleResolver.ts';

describe('CycleResolver', () => {
  describe('normalizeLevel', () => {
    it('normalise les variantes francophones du 1er cycle', () => {
      expect(CycleResolver.normalizeLevel('6e')).toBe('6e');
      expect(CycleResolver.normalizeLevel('6ème')).toBe('6e');
      expect(CycleResolver.normalizeLevel('6eme')).toBe('6e');
      expect(CycleResolver.normalizeLevel('Sixième')).toBe('6e');
      expect(CycleResolver.normalizeLevel('sixième')).toBe('6e');
      expect(CycleResolver.normalizeLevel('Sixième Verte')).toBe('6e');
      expect(CycleResolver.normalizeLevel('6ème A')).toBe('6e');
      expect(CycleResolver.normalizeLevel('5e B')).toBe('5e');
      expect(CycleResolver.normalizeLevel('4ème Espagnol')).toBe('4e');
      expect(CycleResolver.normalizeLevel('3ème')).toBe('3e');
    });

    it('normalise les variantes francophones du 2nd cycle', () => {
      expect(CycleResolver.normalizeLevel('2nde')).toBe('2nde');
      expect(CycleResolver.normalizeLevel('Seconde C')).toBe('2nde');
      expect(CycleResolver.normalizeLevel('1ère A4')).toBe('1ere');
      expect(CycleResolver.normalizeLevel('1ere D')).toBe('1ere');
      expect(CycleResolver.normalizeLevel('Première TI')).toBe('1ere');
      expect(CycleResolver.normalizeLevel('Tle C')).toBe('Tle');
      expect(CycleResolver.normalizeLevel('Terminale D')).toBe('Tle');
    });

    it('normalise les variantes anglophones', () => {
      expect(CycleResolver.normalizeLevel('Form 1')).toBe('Form1');
      expect(CycleResolver.normalizeLevel('form 1 A')).toBe('Form1');
      expect(CycleResolver.normalizeLevel('Form 5 Sciences')).toBe('Form5');
      expect(CycleResolver.normalizeLevel('Lower Sixth')).toBe('LowerSixth');
      expect(CycleResolver.normalizeLevel('LowerSixth Arts')).toBe('LowerSixth');
      expect(CycleResolver.normalizeLevel('L6')).toBe('LowerSixth');
      expect(CycleResolver.normalizeLevel('Upper Sixth')).toBe('UpperSixth');
      expect(CycleResolver.normalizeLevel('UpperSixth')).toBe('UpperSixth');
      expect(CycleResolver.normalizeLevel('U6 Sciences')).toBe('UpperSixth');
    });

    it('normalise primaire et maternelle', () => {
      expect(CycleResolver.normalizeLevel('SIL')).toBe('SIL');
      expect(CycleResolver.normalizeLevel('CP A')).toBe('CP');
      expect(CycleResolver.normalizeLevel('CM2')).toBe('CM2');
      expect(CycleResolver.normalizeLevel('Class 1')).toBe('Class1');
      expect(CycleResolver.normalizeLevel('Class 6')).toBe('Class6');
      expect(CycleResolver.normalizeLevel('Petite section')).toBe('Petite section');
      expect(CycleResolver.normalizeLevel('PS B')).toBe('Petite section');
      expect(CycleResolver.normalizeLevel('PreNursery')).toBe('PreNursery');
      expect(CycleResolver.normalizeLevel('Nursery 1')).toBe('Nursery1');
    });
  });

  describe('resolveCycle', () => {
    it('identifie correctement le 1er cycle', () => {
      expect(CycleResolver.resolveCycle('6e')).toBe('PREMIER_CYCLE');
      expect(CycleResolver.resolveCycle('6ème')).toBe('PREMIER_CYCLE');
      expect(CycleResolver.resolveCycle('3e')).toBe('PREMIER_CYCLE');
      expect(CycleResolver.resolveCycle('Form 1')).toBe('PREMIER_CYCLE');
      expect(CycleResolver.resolveCycle('Form 5')).toBe('PREMIER_CYCLE');
      expect(CycleResolver.resolveCycle('CAP 1')).toBe('PREMIER_CYCLE');
      expect(CycleResolver.isPremierCycle('6ème')).toBe(true);
      expect(CycleResolver.isPremierCycle('Form 1')).toBe(true);
    });

    it('identifie correctement le 2nd cycle', () => {
      expect(CycleResolver.resolveCycle('2nde')).toBe('SECOND_CYCLE');
      expect(CycleResolver.resolveCycle('1ère')).toBe('SECOND_CYCLE');
      expect(CycleResolver.resolveCycle('Tle')).toBe('SECOND_CYCLE');
      expect(CycleResolver.resolveCycle('Terminale')).toBe('SECOND_CYCLE');
      expect(CycleResolver.resolveCycle('LowerSixth')).toBe('SECOND_CYCLE');
      expect(CycleResolver.resolveCycle('Upper Sixth')).toBe('SECOND_CYCLE');
      expect(CycleResolver.resolveCycle('BT 2')).toBe('SECOND_CYCLE');
      expect(CycleResolver.isSecondCycle('1ère')).toBe(true);
      expect(CycleResolver.isSecondCycle('UpperSixth')).toBe(true);
    });

    it('identifie correctement le primaire et la maternelle', () => {
      expect(CycleResolver.resolveCycle('CM2')).toBe('PRIMAIRE');
      expect(CycleResolver.resolveCycle('Class 4')).toBe('PRIMAIRE');
      expect(CycleResolver.isPrimaire('CM2')).toBe(true);

      expect(CycleResolver.resolveCycle('Petite section')).toBe('MATERNELLE');
      expect(CycleResolver.resolveCycle('Nursery 2')).toBe('MATERNELLE');
      expect(CycleResolver.isMaternelle('Nursery 2')).toBe(true);
      expect(CycleResolver.isPrimaireOuMaternelle('CM2')).toBe(true);
      expect(CycleResolver.isPrimaireOuMaternelle('Petite section')).toBe(true);
      expect(CycleResolver.isPrimaireOuMaternelle('6e')).toBe(false);
    });
  });

  describe('resolveSubsystem', () => {
    it('déduit le sous-système francophone ou anglophone', () => {
      expect(CycleResolver.resolveSubsystem('6ème')).toBe('FRANCOPHONE');
      expect(CycleResolver.resolveSubsystem('2nde')).toBe('FRANCOPHONE');
      expect(CycleResolver.resolveSubsystem('Form 1')).toBe('ANGLOPHONE');
      expect(CycleResolver.resolveSubsystem('LowerSixth')).toBe('ANGLOPHONE');
      expect(CycleResolver.resolveSubsystem('Class 3')).toBe('ANGLOPHONE');
      expect(CycleResolver.resolveSubsystem('CM1')).toBe('FRANCOPHONE');
    });
  });
});
