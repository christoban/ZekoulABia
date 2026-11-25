import { describe, expect, it } from 'bun:test';
import { POIDS_NON_PLACEMENT, POIDS_TEMPS_LIBRES_CONSECUTIFS, POIDS_TEMPS_LIBRES_DEBUT_JOURNEE, POIDS_TEMPS_LIBRES_FIN_JOURNEE, POIDS_TEMPS_LIBRES_INTERNE, POIDS_TEMPS_LIBRES_MAX_JOUR } from '../../../../src/domain/ports/services/SchedulingSolverPort.ts';

describe('poids des temps libres', () => {
  it('respecte la calibration demandée', () => {
    expect([POIDS_TEMPS_LIBRES_INTERNE, POIDS_TEMPS_LIBRES_DEBUT_JOURNEE, POIDS_TEMPS_LIBRES_FIN_JOURNEE, POIDS_TEMPS_LIBRES_CONSECUTIFS, POIDS_TEMPS_LIBRES_MAX_JOUR, POIDS_NON_PLACEMENT]).toEqual([100, 40, 5, 2000, 2000, 1_000_000]);
  });
});
