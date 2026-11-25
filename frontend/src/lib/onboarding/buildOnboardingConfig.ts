import type { TemplateCatalogEntry } from './templateCatalogTypes'
import {
  showPremierCycle, showDeuxiemeCycle, showSeriesFr, showStreamsEn,
  showTechnique, showPrimaire, showLv2,
  isPebsFrEligible, isPebsEnEligible,
} from './templateGates'

export type OnboardingConfigInput = {
  niveaux1erCycle: string[]
  classesParNiveau: Record<string, number>
  conventionNommage: string
  lv2Debut: string
  lv2Disponibles: string[]
  niveaux2eCycle: string[]
  filieres: string[]
  a4Languages: string[]
  classesParFiliere: string
  niveauxPrimaire: string[]
  classesParNiveauPrimaire: Record<string, number>
  maternelleSections: string[]
  nurseryLevels: string[]
  filieresTechniques: string[]
  sousTypeTechnique: string
  cetifMode: boolean
  sarMetiers: string[]
  cfmFilieres: string[]
  enGradingSystem: string
  enStreamStartLevel: string
  bilingualEnLevels: string[]
  bilingualEnFilieres: string[]
  hasPEBSFrancophone: boolean
  hasPEBSAnglophone: boolean
  bulletinFrequency: string
  evalSystemPrimaire: string
  appelFrequency: string
}

export function buildOnboardingConfig(
  template: TemplateCatalogEntry,
  input: OnboardingConfigInput,
): Record<string, unknown> {
  const cfg: Record<string, unknown> = {
    templateCode: template.code,
  }

  if (showPremierCycle(template)) {
    cfg.niveaux1erCycle = input.niveaux1erCycle
    cfg.classesParNiveau = input.classesParNiveau
    cfg.conventionNommage = input.conventionNommage
  }

  if (showLv2(template)) {
    cfg.lv2Debut = input.lv2Debut
    cfg.lv2Disponibles = input.lv2Disponibles
  }

  if (showDeuxiemeCycle(template)) {
    cfg.niveaux2eCycle = input.niveaux2eCycle
  }

  if (showSeriesFr(template)) {
    cfg.filieres = input.filieres
    if (input.a4Languages.length) cfg.a4Languages = input.a4Languages
    cfg.classesParFiliere = input.classesParFiliere
  }

  if (showStreamsEn(template)) {
    if (input.enStreamStartLevel) cfg.enStreamStartLevel = input.enStreamStartLevel
    if (input.enGradingSystem) cfg.enGradingSystem = input.enGradingSystem
    if (input.bilingualEnLevels.length) cfg.bilingualEnLevels = input.bilingualEnLevels
    if (input.bilingualEnFilieres.length) cfg.bilingualEnFilieres = input.bilingualEnFilieres
  }

  if (showPrimaire(template) || template.isComplexe) {
    if (input.niveauxPrimaire.length) {
      cfg.niveauxPrimaire = input.niveauxPrimaire
      cfg.classesParNiveauPrimaire = input.classesParNiveauPrimaire
    }
    if (input.maternelleSections.length) cfg.maternelleSections = input.maternelleSections
    if (input.nurseryLevels.length) cfg.nurseryLevels = input.nurseryLevels
    if (input.evalSystemPrimaire) cfg.evalSystemPrimaire = input.evalSystemPrimaire
  }

  const techniqueWanted = showTechnique(template) ||
    (template.isComplexe && (
      input.filieresTechniques.length > 0 ||
      input.sarMetiers.length > 0 ||
      input.cfmFilieres.length > 0
    ))
  if (techniqueWanted) {
    if (input.filieresTechniques.length) cfg.filieresTechniques = input.filieresTechniques
    if (input.sousTypeTechnique) cfg.sousTypeTechnique = input.sousTypeTechnique
    if (input.cetifMode) cfg.cetifMode = input.cetifMode
    if (input.sarMetiers.length) cfg.sarMetiers = input.sarMetiers
    if (input.cfmFilieres.length) cfg.cfmFilieres = input.cfmFilieres
  }

  if (isPebsFrEligible(template.code)) {
    cfg.hasPEBSFrancophone = input.hasPEBSFrancophone
  }
  if (isPebsEnEligible(template.code)) {
    cfg.hasPEBSAnglophone = input.hasPEBSAnglophone
  }

  if (input.bulletinFrequency) cfg.bulletinFrequency = input.bulletinFrequency
  if (input.appelFrequency) cfg.appelFrequency = input.appelFrequency

  return cfg
}
