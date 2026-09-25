import { describe, expect, it } from 'bun:test';
import { calculerCapaciteDisponible, calculerChargeParEnseignant, chevaucheEDT } from '../../../../src/domain/rules/CapaciteEmploiDuTemps.ts';

const grid = Array.from({ length: 38 }, (_, index) => ({ dayOfWeek: Math.floor(index / 7), startTime: `${String(8 + Math.floor((index % 7) / 2)).padStart(2, '0')}:${index % 2 ? '30' : '00'}`, endTime: `${String(8 + Math.floor((index % 7) / 2)).padStart(2, '0')}:${index % 2 ? '59' : '30'}` }));

describe('capacite et charge', () => {
  it('additionne les affectations par enseignant sans compter les volumes absents', () => {
    expect([...calculerChargeParEnseignant([
      { teacherId: 'gaelle', weeklyPeriods: 4 },
      { teacherId: 'gaelle', weeklyPeriods: null },
      { teacherId: 'daniel', weeklyPeriods: 3 },
    ])]).toEqual([['gaelle', 4], ['daniel', 3]]);
  });


  it('soustrait indisponibilités et occupation fixe de la grille', () => {
    expect(calculerCapaciteDisponible(grid, [{ teacherId: 'gaelle', dayOfWeek: 0, startTime: '08:00', endTime: '08:30' }], [{ teacherId: 'gaelle', dayOfWeek: 0, startTime: '08:30', endTime: '08:59' }], 'gaelle')).toBe(36);
  });

  it('conserve la capacité globale sans filtre enseignant', () => {
    expect(calculerCapaciteDisponible(grid, [{ teacherId: 'gaelle', dayOfWeek: 0, startTime: '08:00', endTime: '08:30' }], [])).toBe(37);
  });

  it('détecte les chevauchements avec les bornes temporelles', () => {
    expect(chevaucheEDT({ dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }, { dayOfWeek: 0, startTime: '08:59', endTime: '10:00' })).toBe(true);
    expect(chevaucheEDT({ dayOfWeek: 0, startTime: '08:00', endTime: '09:00' }, { dayOfWeek: 0, startTime: '09:00', endTime: '10:00' })).toBe(false);
  });
});
