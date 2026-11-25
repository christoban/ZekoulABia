import { describe, expect, it } from 'bun:test'
import { buildOnboardingConfig, type OnboardingConfigInput } from './buildOnboardingConfig'
import { templateDisplayName } from './templateSelection'
import type { TemplateCatalogEntry } from './templateCatalogTypes'

const input: OnboardingConfigInput = {
  niveaux1erCycle: ['Form 1'],
  classesParNiveau: { 'Form 1': 2 },
  conventionNommage: 'LETTRES',
  lv2Debut: 'NON_APPLICABLE',
  lv2Disponibles: [],
  niveaux2eCycle: ['Lower Sixth'],
  filieres: ['C'],
  a4Languages: [],
  classesParFiliere: '1',
  niveauxPrimaire: ['Class 1'],
  classesParNiveauPrimaire: { 'Class 1': 2 },
  maternelleSections: [],
  nurseryLevels: [],
  filieresTechniques: [],
  sousTypeTechnique: '',
  cetifMode: false,
  sarMetiers: [],
  cfmFilieres: [],
  enGradingSystem: 'OVER_20',
  enStreamStartLevel: 'FORM4',
  bilingualEnLevels: [],
  bilingualEnFilieres: [],
  hasPEBSFrancophone: true,
  hasPEBSAnglophone: true,
  bulletinFrequency: 'MONTHLY',
  evalSystemPrimaire: 'NOTES_20',
  appelFrequency: 'TWICE',
}

function entry(overrides: Partial<TemplateCatalogEntry>): TemplateCatalogEntry {
  return {
    code: 'TEST',
    name: 'Template test',
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
  }
}

describe('buildOnboardingConfig', () => {
  it('filtre les filieres pour GHS_EN mais conserve enGradingSystem', () => {
    const config = buildOnboardingConfig(entry({
      code: 'GHS_EN',
      name: 'Government High School',
      subsystem: 'ANGLOPHONE',
      hasPremierCycle: true,
      hasDeuxiemeCycle: true,
      langMode: 'anglophone',
    }), input)

    expect(config.filieres).toBeUndefined()
    expect(config.enGradingSystem).toBe('OVER_20')
  })

  it('conserve les filieres de LYCEE_FR et filtre enStreamStartLevel', () => {
    const config = buildOnboardingConfig(entry({
      code: 'LYCEE_FR',
      name: 'Lycée Général Francophone',
      hasPremierCycle: true,
      hasDeuxiemeCycle: true,
    }), input)

    expect(config.filieres).toEqual(['C'])
    expect(config.enStreamStartLevel).toBeUndefined()
  })

  it('filtre les champs du secondaire pour PRIMAIRE_FR', () => {
    const config = buildOnboardingConfig(entry({
      code: 'PRIMAIRE_FR',
      name: 'École Primaire Francophone',
      level: 'PRIMARY',
      isPrimaire: true,
    }), input)

    expect(config.niveaux2eCycle).toBeUndefined()
    expect(config.filieres).toBeUndefined()
  })

  it('conserve PEBS francophone pour CES_FR sans PEBS anglophone', () => {
    const config = buildOnboardingConfig(entry({
      code: 'CES_FR',
      name: "Collège d'Enseignement Secondaire",
      hasPremierCycle: true,
    }), input)

    expect(config.hasPEBSFrancophone).toBe(true)
    expect(config.hasPEBSAnglophone).toBeUndefined()
  })

  it('affiche le nom anglais du lycée bilingue', () => {
    const bilingual = entry({
      code: 'LYCEE_BILINGUE',
      name: 'Lycée Bilingue',
      subsystem: 'BILINGUAL',
      langMode: 'bilingual',
      nameFr: 'Lycée Bilingue',
      nameEn: 'Government Bilingual High School',
    })

    expect(templateDisplayName(bilingual, 'en')).toBe('Government Bilingual High School')
  })

  it('conserve les filières techniques d’un complexe', () => {
    const config = buildOnboardingConfig(entry({
      code: 'COMPLEXE_SCOLAIRE',
      name: 'Complexe Scolaire',
      educationType: 'MIXED',
      level: 'COMPLEX',
      isComplexe: true,
    }), { ...input, filieresTechniques: ['F1'] })

    expect(config.filieresTechniques).toEqual(['F1'])
  })

  it('conserve le primaire d’un complexe', () => {
    const config = buildOnboardingConfig(entry({
      code: 'COMPLEXE_SCOLAIRE',
      name: 'Complexe Scolaire',
      educationType: 'MIXED',
      level: 'COMPLEX',
      isComplexe: true,
    }), input)

    expect(config.niveauxPrimaire).toEqual(['Class 1'])
  })

  it('ne transmet pas les filières techniques d’un GHS sans données techniques', () => {
    const config = buildOnboardingConfig(entry({
      code: 'GHS_EN',
      name: 'Government High School',
      subsystem: 'ANGLOPHONE',
      hasPremierCycle: true,
      hasDeuxiemeCycle: true,
      langMode: 'anglophone',
    }), input)

    expect(config.filieresTechniques).toBeUndefined()
  })
})
