import { getPasswordStrength } from '@/components/PasswordStrengthBar'
import type { OfferFlag, Phase1Profile } from '@/lib/onboarding/phase1Profile'
import type { TemplateCatalogEntry } from '@/lib/onboarding/templateCatalogTypes'
import { showPremierCycle, showDeuxiemeCycle, showSeriesFr, showStreamsEn } from '@/lib/onboarding/templateGates'
import type { EnGradingSystem, EnStreamStartLevel, FormData } from './types'

export function validateStep1Data(params: {
  form: FormData
  profile: Phase1Profile
  effectiveCode: string | null
  templateCatalog: TemplateCatalogEntry[]
  t: (key: string) => string
}): string {
  const { form, profile, effectiveCode, templateCatalog, t } = params
  if (!form.nom.trim()) return "Le nom de l'établissement est requis."
  if (!form.subdomain.trim()) return 'Le sous-domaine est requis.'
  if (!/^[a-z0-9-]+$/.test(form.subdomain)) return 'Le sous-domaine ne peut contenir que des lettres minuscules, chiffres et tirets.'
  if (form.subdomain.length < 3) return 'Le sous-domaine doit faire au moins 3 caractères.'
  if (!profile.subsystem) return t('phase1.step1.validation.subsystem')
  if (!profile.structure) return t('phase1.step1.validation.structure')
  if (profile.structure === 'MONO' && !profile.levelFamily) return t('phase1.step1.validation.levelFamily')
  if (profile.offers.length === 0) return t('phase1.step1.validation.offers')
  if (profile.levelFamily === 'SECONDARY' && profile.offers.length > 0 && profile.secondarySpan === null) {
    return t('phase1.step1.validation.secondarySpan')
  }
  if (!profile.ownership) return t('phase1.step1.validation.ownership')
  if (!effectiveCode || !templateCatalog.some((candidate) => candidate.code === effectiveCode)) {
    return t('phase1.step1.validation.template')
  }
  return ''
}

export function validateStep2Data(form: FormData): string {
  if (!form.adminPrenom.trim()) return 'Le prénom est requis.'
  if (!form.adminNom.trim()) return 'Le nom de famille est requis.'
  if (!form.adminEmail.trim() || !form.adminEmail.includes('@')) return 'Adresse email invalide.'
  if (getPasswordStrength(form.password) < 5) {
    return 'Le mot de passe ne respecte pas toutes les règles de sécurité (12 car., majuscule, minuscule, chiffre, caractère spécial).'
  }
  if (form.password !== form.confirmPassword) return 'Les mots de passe ne correspondent pas.'
  return ''
}

export function validateStep3Data(params: {
  template: TemplateCatalogEntry | null
  form: FormData
  offers: OfferFlag[]
  maternelleSections: string[]
  bilingualEnLevels: string[]
  bilingualEnFilieres: string[]
  sarMetiers: string[]
  cfmFilieres: string[]
  enStreamStartLevel: EnStreamStartLevel
  enGradingSystem: EnGradingSystem
  t: (key: string) => string
}): string {
  const {
    template,
    form,
    offers,
    maternelleSections,
    bilingualEnLevels,
    bilingualEnFilieres,
    sarMetiers,
    cfmFilieres,
    enStreamStartLevel,
    enGradingSystem,
    t,
  } = params

  if (!template) return "Impossible de détecter le type d'établissement."

  if (template.isComplexe) {
    const hasPrimaireCfg = form.niveauxPrimaire.length > 0 || maternelleSections.length > 0
    const has1erCfg = form.niveaux1erCycle.length > 0
    const has2eCfg = form.niveaux2eCycle.length > 0
    if (!hasPrimaireCfg && !has1erCfg && !has2eCfg) {
      return 'Configurez au moins un cycle (maternelle/primaire, 1er cycle ou 2nd cycle).'
    }
    if (has1erCfg && Object.keys(form.classesParNiveau).length < form.niveaux1erCycle.length) {
      return 'Veuillez indiquer le nombre de classes pour chaque niveau du 1er cycle.'
    }
    if (has2eCfg && form.filieres.length === 0 && !bilingualEnLevels.length && !bilingualEnFilieres.length) {
      return 'Veuillez sélectionner au moins une filière ou configurer le volet anglophone.'
    }
    if (form.niveauxPrimaire.length > 0 && Object.keys(form.classesParNiveauPrimaire).length < form.niveauxPrimaire.length) {
      return 'Veuillez indiquer le nombre de classes pour chaque niveau primaire.'
    }
    if (offers.includes('TECHNICAL') && form.filieresTechniques.length === 0) {
      return t('phase1.step1.validation.technicalOffers')
    }
    if (offers.includes('PROFESSIONAL') && sarMetiers.length === 0 && cfmFilieres.length === 0) {
      return t('phase1.step1.validation.professionalOffers')
    }
    return ''
  }

  if (showPremierCycle(template) && form.niveaux1erCycle.length === 0) {
    return 'Veuillez sélectionner au moins un niveau du 1er cycle.'
  }
  if (showPremierCycle(template) && Object.keys(form.classesParNiveau).length < form.niveaux1erCycle.length) {
    return 'Veuillez indiquer le nombre de classes pour chaque niveau.'
  }
  if (showDeuxiemeCycle(template) && form.niveaux2eCycle.length === 0) {
    return 'Veuillez sélectionner au moins un niveau du 2e cycle.'
  }
  if (showSeriesFr(template) && form.filieres.length === 0) {
    return 'Veuillez sélectionner au moins une filière.'
  }
  if (showStreamsEn(template)) {
    if (template.code !== 'GSS_EN' && !enStreamStartLevel) return 'Veuillez sélectionner le niveau de départ des streams.'
    if (!enGradingSystem) return 'Veuillez sélectionner un système de notes.'
  }
  return ''
}
