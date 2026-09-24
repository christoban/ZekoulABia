import { describe, expect, it } from 'bun:test';
import { calculerSqelette } from '../../../../src/infrastructure/http/controllers/TimetableGridConfigController.ts';

describe('Grille horaire — périodes par jour', () => {
  const config = {
    heureDebut: '07:30', dureePeriode: 55, periodesAvantP1: 2, dureePetitePause: 15,
    periodesAvantP2: 3, dureeGrandePause: 30, periodesApresP2: 2,
    periodesCoursParJour: { SAMEDI: 5 },
  };

  it('conserve les périodes après la grande pause pour un jour normal', () => {
    const periods = calculerSqelette(config, 'LUNDI');
    expect(periods.filter(p => p.type === 'COURS')).toHaveLength(7);
    expect(periods.some(p => p.type === 'GRANDE_PAUSE')).toBe(true);
  });

  it('arrête le samedi à la fin des périodes avant la grande pause', () => {
    const periods = calculerSqelette(config, 'SAMEDI');
    expect(periods.filter(p => p.type === 'COURS')).toHaveLength(5);
    expect(periods.some(p => p.type === 'GRANDE_PAUSE')).toBe(false);
    expect(periods.at(-1)?.fin).toBe('12:20');
  });
});
