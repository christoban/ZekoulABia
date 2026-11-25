import { describe, it, expect } from 'bun:test';
type TemplateCatalogEntry = {
  code: string; name: string; subsystem: 'FRANCOPHONE' | 'ANGLOPHONE' | 'BILINGUAL';
  educationType: 'GENERAL' | 'TECHNICAL' | 'PROFESSIONAL' | 'MIXED'; level: string;
  hasPremierCycle: boolean; hasDeuxiemeCycle: boolean; isTechnique: boolean; isPrimaire: boolean; isComplexe: boolean;
  langMode: 'francophone' | 'anglophone' | 'bilingual'; ownershipHint: any;
};
function showPremierCycle(t: TemplateCatalogEntry | null): boolean { return !!t?.hasPremierCycle; }
function showDeuxiemeCycle(t: TemplateCatalogEntry | null): boolean { return !!t?.hasDeuxiemeCycle; }
function showSeriesFr(t: TemplateCatalogEntry | null): boolean { if (!t?.hasDeuxiemeCycle) return false; return t.subsystem === 'FRANCOPHONE' || t.subsystem === 'BILINGUAL'; }
function showStreamsEn(t: TemplateCatalogEntry | null): boolean { if (!t?.hasDeuxiemeCycle) return false; return t.subsystem === 'ANGLOPHONE' || t.subsystem === 'BILINGUAL'; }

function makeEntry(overrides: Partial<TemplateCatalogEntry>): TemplateCatalogEntry {
  return {
    code: 'TEST',
    name: 'Test',
    subsystem: 'FRANCOPHONE',
    educationType: 'GENERAL',
    level: 'SECONDARY',
    hasPremierCycle: false,
    hasDeuxiemeCycle: false,
    isTechnique: false,
    isPrimaire: false,
    isComplexe: false,
    langMode: 'francophone',
    ownershipHint: null,
    ...overrides,
  } as TemplateCatalogEntry;
}

describe('templateGates', () => {
  it('showSeriesFr(LYCEE_FR) true ; showStreamsEn false', () => {
    const t = makeEntry({ code: 'LYCEE_FR', subsystem: 'FRANCOPHONE', hasDeuxiemeCycle: true, langMode: 'francophone' });
    expect(showSeriesFr(t)).toBe(true);
    expect(showStreamsEn(t)).toBe(false);
  });
  it('showStreamsEn(GHS_EN) true ; showSeriesFr false', () => {
    const t = makeEntry({ code: 'GHS_EN', subsystem: 'ANGLOPHONE', hasDeuxiemeCycle: true, langMode: 'anglophone' });
    expect(showStreamsEn(t)).toBe(true);
    expect(showSeriesFr(t)).toBe(false);
  });
  it('LYCEE_BILINGUE both true', () => {
    const t = makeEntry({ code: 'LYCEE_BILINGUE', subsystem: 'BILINGUAL', hasDeuxiemeCycle: true, langMode: 'bilingual' });
    expect(showSeriesFr(t)).toBe(true);
    expect(showStreamsEn(t)).toBe(true);
  });
  it('CES_FR premier true, deuxieme false', () => {
    const t = makeEntry({ code: 'CES_FR', subsystem: 'FRANCOPHONE', hasPremierCycle: true, hasDeuxiemeCycle: false });
    expect(showPremierCycle(t)).toBe(true);
    expect(showDeuxiemeCycle(t)).toBe(false);
  });
});
