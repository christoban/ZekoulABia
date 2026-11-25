import { describe, it, expect } from 'bun:test';
import { resolveAtelierFields } from '../../../../src/application/statisticalCampaign/resolveAtelierFields.ts';
import { ATELIER_MAX_ROWS, ATELIER_COLS } from '../../../../src/application/statisticalCampaign/minesecAteliersFieldMap.ts';

describe('resolveAtelierFields', () => {
  it('mapping prêt + 1 atelier complet → cellules nom/état/postes présentes', () => {
    const { cells, nonCouverts } = resolveAtelierFields([
      {
        atelier: 'Menuiserie',
        etat: 'Bon',
        nombrePostesTravail: 12,
        equipements: [{ designation: 'Scie', quantite: 3, etat: 'Neuf' }],
      },
    ]);
    // numero + atelier + workshop miroir + etat + stateEn + designation x2 + quantite x2 + etatEq x2 + postes x2 = ~11 cells
    expect(cells.length).toBeGreaterThanOrEqual(7);
    const refs = cells.map((c) => c.cellReference);
    expect(refs).toContain(`${ATELIER_COLS.atelier}8`);
    expect(refs).toContain(`${ATELIER_COLS.etatAtelier}8`);
    expect(refs).toContain(`${ATELIER_COLS.nombrePostes}8`);
    expect(refs).toContain(`${ATELIER_COLS.designationEquipement}8`);
    expect(refs).toContain(`${ATELIER_COLS.quantite}8`);
    expect(nonCouverts.filter((n) => n.fieldCode === 'ATELIER_NOM')).toHaveLength(0);
  });

  it('sans nom → ATELIER_NOM dans nonCouverts', () => {
    const { cells, nonCouverts } = resolveAtelierFields([{ etat: 'Bon' }]);
    expect(nonCouverts.some((n) => n.fieldCode === 'ATELIER_NOM')).toBe(true);
    expect(cells.some((c) => c.cellReference === `${ATELIER_COLS.atelier}8`)).toBe(false);
  });

  it('liste > MAX → ATELIER_LIGNES_INSUFFISANTES + seulement MAX lignes en cells', () => {
    const many = Array.from({ length: ATELIER_MAX_ROWS + 5 }, (_, i) => ({ atelier: `A${i}` }));
    const { cells, nonCouverts } = resolveAtelierFields(many);
    expect(nonCouverts.some((n) => n.fieldCode === 'ATELIER_LIGNES_INSUFFISANTES')).toBe(true);
    // chaque entrée produit au moins 2 cells (numero + atelier + workshop)
    const numeros = cells.filter((c) => c.cellReference.startsWith(ATELIER_COLS.numero));
    expect(numeros.length).toBe(ATELIER_MAX_ROWS);
  });

  it('tableau vide → 0 cells, 0 nonCouverts', () => {
    const { cells, nonCouverts } = resolveAtelierFields([]);
    expect(cells).toHaveLength(0);
    expect(nonCouverts).toHaveLength(0);
  });

  it('atelier sans equipement → pas de cellules equipement, mais atelier présent', () => {
    const { cells } = resolveAtelierFields([{ atelier: 'Forge', etat: 'Moyen', nombrePostesTravail: 5 }]);
    expect(cells.some((c) => c.cellReference === `${ATELIER_COLS.atelier}8`)).toBe(true);
    expect(cells.some((c) => c.cellReference === `${ATELIER_COLS.designationEquipement}8`)).toBe(false);
  });
});
