import { describe, expect, it } from 'bun:test'
import { resolveTemplateCandidates } from './resolveTemplateCandidates'
import type { TemplateCatalogEntry } from './templateCatalogTypes'
import type { Phase1Profile } from './phase1Profile'

function entry(code: string, overrides: Partial<TemplateCatalogEntry> = {}): TemplateCatalogEntry {
  return {
    code,
    name: code,
    subsystem: 'FRANCOPHONE',
    educationType: 'GENERAL',
    level: 'SECONDARY',
    hasPremierCycle: true,
    hasDeuxiemeCycle: true,
    isTechnique: false,
    isPrimaire: false,
    isComplexe: false,
    langMode: 'francophone',
    ownershipHint: null,
    ...overrides,
  }
}

const catalog: TemplateCatalogEntry[] = [
  entry('PRIMAIRE_FR', { level: 'PRIMARY', isPrimaire: true }),
  entry('MATERNELLE_FR', { level: 'PRIMARY', isPrimaire: true }),
  entry('LYCEE_FR'),
  entry('CES_FR', { hasDeuxiemeCycle: false }),
  entry('PRIVE_FR', { ownershipHint: ['PRIVATE_SECULAR', 'PRIVATE_FAITH'] }),
  entry('LYCEE_TECHNIQUE_FR', { educationType: 'TECHNICAL', isTechnique: true }),
  entry('CETIC', { educationType: 'TECHNICAL', hasDeuxiemeCycle: false, isTechnique: true }),
  entry('SAR_SM', { educationType: 'PROFESSIONAL' }),
  entry('CFM', { educationType: 'PROFESSIONAL' }),
  entry('GHS_EN', { subsystem: 'ANGLOPHONE' }),
  entry('GSS_EN', { subsystem: 'ANGLOPHONE', hasDeuxiemeCycle: false }),
  entry('PRIVE_EN', { subsystem: 'ANGLOPHONE', ownershipHint: ['PRIVATE_SECULAR', 'PRIVATE_FAITH'] }),
  entry('PRIMARY_EN', { subsystem: 'ANGLOPHONE', level: 'PRIMARY', isPrimaire: true }),
  entry('NURSERY_EN', { subsystem: 'ANGLOPHONE', level: 'PRIMARY', isPrimaire: true }),
  entry('GTC_EN', { subsystem: 'ANGLOPHONE', educationType: 'TECHNICAL', hasDeuxiemeCycle: false, isTechnique: true }),
  entry('GTC_GTHS_EN', { subsystem: 'ANGLOPHONE', educationType: 'TECHNICAL', isTechnique: true }),
  entry('LYCEE_BILINGUE', { subsystem: 'BILINGUAL' }),
  entry('PRIMARY_BILINGUAL', { subsystem: 'BILINGUAL', level: 'PRIMARY', isPrimaire: true }),
  entry('COMPLEXE_SCOLAIRE', { subsystem: 'FRANCOPHONE', educationType: 'MIXED', isComplexe: true }),
]

function profile(overrides: Partial<Phase1Profile>): Phase1Profile {
  return {
    subsystem: 'FRANCOPHONE',
    structure: 'MONO',
    levelFamily: 'SECONDARY',
    offers: ['GENERAL'],
    secondarySpan: null,
    ownership: 'PUBLIC',
    selectedTemplateCode: null,
    ...overrides,
  }
}

const codes = (value: TemplateCatalogEntry[]): string[] => value.map((item) => item.code)

describe('resolveTemplateCandidates', () => {
  it('retourne PRIMAIRE_FR pour le primaire francophone', () => {
    expect(codes(resolveTemplateCandidates(catalog, profile({ levelFamily: 'PRIMARY' })))).toEqual(['PRIMAIRE_FR'])
  })

  it('retourne CES_FR pour une scolarité francophone jusqu’à la 3e', () => {
    expect(codes(resolveTemplateCandidates(catalog, profile({ secondarySpan: 'TO_3E' })))).toEqual(['CES_FR'])
  })

  it('retourne LYCEE_FR pour une scolarité francophone jusqu’à la Terminale', () => {
    expect(codes(resolveTemplateCandidates(catalog, profile({ secondarySpan: 'TO_TLE' })))).toEqual(['LYCEE_FR'])
  })

  it('place PRIVE_FR en tête pour un secondaire francophone privé', () => {
    expect(codes(resolveTemplateCandidates(catalog, profile({ ownership: 'PRIVATE_SECULAR' })))[0]).toBe('PRIVE_FR')
  })

  it('retourne GHS_EN pour Upper Sixth', () => {
    expect(codes(resolveTemplateCandidates(catalog, profile({ subsystem: 'ANGLOPHONE', secondarySpan: 'TO_UPPER_SIXTH' })))).toEqual(['GHS_EN'])
  })

  it('retourne GSS_EN pour Form 5', () => {
    expect(codes(resolveTemplateCandidates(catalog, profile({ subsystem: 'ANGLOPHONE', secondarySpan: 'TO_FORM5' })))).toEqual(['GSS_EN'])
  })

  it('retourne CETIC pour le premier cycle technique francophone', () => {
    expect(codes(resolveTemplateCandidates(catalog, profile({ offers: ['TECHNICAL'], secondarySpan: 'TECH_1ER' })))).toEqual(['CETIC'])
  })

  it('retourne CFM pour la filière professionnelle CFM', () => {
    expect(codes(resolveTemplateCandidates(catalog, profile({ offers: ['PROFESSIONAL'], secondarySpan: 'PRO_CFM' })))).toEqual(['CFM'])
  })

  it('retourne LYCEE_BILINGUE pour le secondaire bilingue', () => {
    expect(codes(resolveTemplateCandidates(catalog, profile({ subsystem: 'BILINGUAL' })))).toEqual(['LYCEE_BILINGUE'])
  })

  it('retourne uniquement le complexe pour une structure COMPLEX', () => {
    expect(codes(resolveTemplateCandidates(catalog, profile({ structure: 'COMPLEX', offers: [] })))).toEqual(['COMPLEXE_SCOLAIRE'])
  })
})
