import type { TemplateCatalogEntry } from './templateCatalogTypes'
import type { OfferFlag } from './phase1Profile'

const PEBS_FR = new Set(['LYCEE_FR', 'CES_FR', 'PRIVE_FR', 'LYCEE_BILINGUE'])
const PEBS_EN = new Set(['GHS_EN', 'GSS_EN', 'PRIVE_EN', 'LYCEE_BILINGUE'])

export const isPebsFrEligible = (code: string): boolean => PEBS_FR.has(code)
export const isPebsEnEligible = (code: string): boolean => PEBS_EN.has(code)

export function showPremierCycle(t: TemplateCatalogEntry | null): boolean {
  return !!t?.hasPremierCycle
}
export function showDeuxiemeCycle(t: TemplateCatalogEntry | null): boolean {
  return !!t?.hasDeuxiemeCycle
}
export function showSeriesFr(t: TemplateCatalogEntry | null): boolean {
  if (!t?.hasDeuxiemeCycle) return false
  return t.subsystem === 'FRANCOPHONE' || t.subsystem === 'BILINGUAL'
}
export function showStreamsEn(t: TemplateCatalogEntry | null): boolean {
  if (!t?.hasDeuxiemeCycle) return false
  return t.subsystem === 'ANGLOPHONE' || t.subsystem === 'BILINGUAL'
}
export function showTechnique(t: TemplateCatalogEntry | null): boolean {
  return !!t?.isTechnique
}
export function showPrimaire(t: TemplateCatalogEntry | null): boolean {
  return !!t?.isPrimaire
}
export function showLv2(t: TemplateCatalogEntry | null): boolean {
  if (!t?.hasPremierCycle) return false
  return t.langMode === 'francophone' || t.langMode === 'bilingual'
}

export function hasMaternelleData(input: { maternelleSections: string[]; nurseryLevels: string[] }): boolean {
  return input.maternelleSections.length > 0 || input.nurseryLevels.length > 0
}

export function hasPrimaireData(input: { niveauxPrimaire: string[] }): boolean {
  return input.niveauxPrimaire.length > 0
}

export function hasPremierCycleData(input: { niveaux1erCycle: string[] }): boolean {
  return input.niveaux1erCycle.length > 0
}

export function hasDeuxiemeCycleData(input: { niveaux2eCycle: string[]; filieres: string[] }): boolean {
  return input.niveaux2eCycle.length > 0 || input.filieres.length > 0
}

export function hasTechniqueData(input: {
  filieresTechniques: string[]
  sarMetiers?: string[]
  cfmFilieres?: string[]
}): boolean {
  return input.filieresTechniques.length > 0 ||
    (input.sarMetiers?.length ?? 0) > 0 ||
    (input.cfmFilieres?.length ?? 0) > 0
}

export function showTechniqueBlocks(
  template: TemplateCatalogEntry | null,
  offers: OfferFlag[],
): boolean {
  if (!template) return false
  if (template.isTechnique) return true
  return template.isComplexe && (offers.includes('TECHNICAL') || offers.includes('PROFESSIONAL'))
}
