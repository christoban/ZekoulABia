import { describe, it, expect } from 'bun:test';
import { pickManuelsDetail } from '../../../../src/application/statisticalCampaign/GenererDeclarationStatistiqueMinesecUseCase.ts';

describe('pickManuelsDetail', () => {
  it('préfère manuelsDetail', () => {
    expect(pickManuelsDetail({ manuelsDetail: [{ code: 'A' }], manuelDetail: [] })).toEqual([{ code: 'A' }]);
  });
  it('rétrocompat manuelDetail', () => {
    expect(pickManuelsDetail({ manuelDetail: [{ code: 'B' }] })).toEqual([{ code: 'B' }]);
  });
  it('vide si absent', () => {
    expect(pickManuelsDetail({})).toEqual([]);
    expect(pickManuelsDetail(null)).toEqual([]);
    expect(pickManuelsDetail(undefined)).toEqual([]);
  });
  it('préfère pluriel même si singulier non vide', () => {
    expect(
      pickManuelsDetail({ manuelsDetail: [{ code: 'PLURIEL' }], manuelDetail: [{ code: 'SINGULIER' }] }),
    ).toEqual([{ code: 'PLURIEL' }]);
  });
});
