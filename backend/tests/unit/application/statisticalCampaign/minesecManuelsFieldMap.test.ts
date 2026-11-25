import { describe, it, expect } from 'bun:test';
import { MANUELS_FIELD_MAPPING } from '../../../../src/application/statisticalCampaign/minesecManuelsFieldMap.ts';

describe('minesecManuelsFieldMap — Manuels-Didactics', () => {
  it('couvre les codes 5100-5132 (30 disciplines)', () => {
    expect(MANUELS_FIELD_MAPPING.length).toBe(33);
    const codes = MANUELS_FIELD_MAPPING.map((m) => m.fieldCode);
    expect(codes[0]).toBe('5100');
    expect(codes[31]).toBe('5131');
    expect(codes[32]).toBe('5132');
  });

  it('chaque discipline a 7 cellules anglophones + 7 francophones + other', () => {
    for (const m of MANUELS_FIELD_MAPPING) {
      expect(m.anglophoneCells.length).toBe(7);
      expect(m.francophoneCells.length).toBe(7);
      expect(m.otherCell).toBeTruthy();
    }
  });

  it('les colonnes anglophones suivent le schéma officiel (Form1=D, UpperSixth=J)', () => {
    const french = MANUELS_FIELD_MAPPING[0];
    expect(french.anglophoneCells.find((c) => c.level === 'Form1')?.cell).toBe('D16');
    expect(french.anglophoneCells.find((c) => c.level === 'UpperSixth')?.cell).toBe('J16');
    expect(french.francophoneCells.find((c) => c.level === '6e')?.cell).toBe('M16');
    expect(french.francophoneCells.find((c) => c.level === 'Tle')?.cell).toBe('S16');
  });
});
