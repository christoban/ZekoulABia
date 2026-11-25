import { describe, it, expect } from 'bun:test';
import { resolveEsgEngFields } from '../../../../src/application/statisticalCampaign/resolveEsgEngFields.ts';
import type { StatisticalQueryPort, EleveEsgRow } from '@domain/ports/repositories/StatisticalQueryPort';

function stubQuery(students: EleveEsgRow[]): StatisticalQueryPort {
  return {
    listerElevesEsg: async () => students,
  } as unknown as StatisticalQueryPort;
}

describe('resolveEsgEngFields — Students_ESG_Eng', () => {
  it('compte les élèves Form1 par sexe (cellule D/E ligne 43)', async () => {
    const students: EleveEsgRow[] = [
      { gender: 'F', dateOfBirth: null, niveau: 'Form1', serie: null, filiere: null, lv2Name: null },
      { gender: 'M', dateOfBirth: null, niveau: 'Form1', serie: null, filiere: null, lv2Name: null },
    ];
    const { cells } = await resolveEsgEngFields(stubQuery(students), 'school-1');
    const d43 = cells.find((c) => c.cellReference === 'D43');
    const e43 = cells.find((c) => c.cellReference === 'E43');
    expect(d43?.value).toBe(1);
    expect(e43?.value).toBe(1);
    expect(cells.every((c) => c.sheetName === 'Students_ESG_Eng')).toBe(true);
  });

  it('compte UpperSixth Arts dans la colonne M67', async () => {
    const students: EleveEsgRow[] = [
      { gender: 'F', dateOfBirth: null, niveau: 'UpperSixth', serie: 'Arts', filiere: null, lv2Name: null },
    ];
    const { cells } = await resolveEsgEngFields(stubQuery(students), 'school-1');
    const m67 = cells.find((c) => c.cellReference === 'M67');
    expect(m67?.value).toBe(1);
  });

  it('gère la répartition par âge (ligne 18 = 12 ans)', async () => {
    const students: EleveEsgRow[] = [
      { gender: 'F', dateOfBirth: new Date('2013-05-01'), niveau: 'Form1', serie: null, filiere: null, lv2Name: null },
    ];
    const { cells } = await resolveEsgEngFields(stubQuery(students), 'school-1');
    // Reference date = 1 sept de l'année scolaire ; un élève né en 2013 aura 12 ans en 2025
    const d18 = cells.find((c) => c.cellReference === 'D18');
    expect(d18).toBeDefined();
  });

  it('signale les redoublants comme gap (jamais déduits)', async () => {
    const { nonCouverts } = await resolveEsgEngFields(stubQuery([]), 'school-1');
    expect(nonCouverts.length).toBeGreaterThan(0);
    expect(nonCouverts.every((g) => g.fieldLabel.includes('Repeaters'))).toBe(true);
  });
});
