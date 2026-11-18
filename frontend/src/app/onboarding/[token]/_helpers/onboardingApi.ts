import { buildOnboardingConfig } from '@/lib/onboarding/buildOnboardingConfig'
import type { TemplateCatalogEntry } from '@/lib/onboarding/templateCatalogTypes'
import type {
  AppelFrequency,
  BulletinFrequency,
  EnGradingSystem,
  EnStreamStartLevel,
  EvalSystemPrimaire,
  FormData,
  InviteData,
  PreviewData,
  TechnicalSubtype,
} from './types'

export async function fetchTemplateCatalogApi(): Promise<TemplateCatalogEntry[] | null> {
  try {
    const res = await fetch('/api/v2/onboarding/template-catalog')
    const data = await res.json()
    if (data?.success && Array.isArray(data.data?.templates)) {
      return data.data.templates as TemplateCatalogEntry[]
    }
  } catch {
    // silencieux
  }
  return null
}

export async function verifyInviteTokenApi(
  token: string,
  signal: AbortSignal
): Promise<{ success: boolean; data?: InviteData; message?: string }> {
  const res = await fetch(`/api/v2/onboarding/invite/${token}`, {
    signal,
    headers: { 'ngrok-skip-browser-warning': '1' },
  })
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`HTTP ${res.status}`)
  }
  return res.json()
}

export async function fetchPreviewStructureApi(params: {
  templateCode?: string
  form: FormData
  signal: AbortSignal
}): Promise<PreviewData | null> {
  const { templateCode, form, signal } = params
  const res = await fetch('/api/v2/onboarding/preview-structure', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
    body: JSON.stringify({
      templateCode,
      niveaux1erCycle: form.niveaux1erCycle,
      classesParNiveau: form.classesParNiveau,
      conventionNommage: form.conventionNommage,
      niveaux2eCycle: form.niveaux2eCycle,
      filieres: form.filieres,
      a4Languages: form.a4Languages,
      classesParFiliere: form.classesParFiliere,
      lv2Disponibles: form.lv2Disponibles,
      niveauxPrimaire: form.niveauxPrimaire,
      classesParNiveauPrimaire: form.classesParNiveauPrimaire,
    }),
  })
  const data = await res.json()
  return data.success ? (data.data as PreviewData) : null
}

export interface SubmitOnboardingParams {
  token: string
  form: FormData
  template: TemplateCatalogEntry | null
  maternelleSections: string[]
  nurseryLevels: string[]
  sousTypeTechnique: TechnicalSubtype
  cetifMode: boolean
  sarMetiers: string[]
  cfmFilieres: string[]
  enGradingSystem: EnGradingSystem
  enStreamStartLevel: EnStreamStartLevel
  bilingualEnLevels: string[]
  bilingualEnFilieres: string[]
  hasPEBSFrancophone: boolean
  hasPEBSAnglophone: boolean
  bulletinFrequency: BulletinFrequency
  evalSystemPrimaire: EvalSystemPrimaire
  appelFrequency: AppelFrequency
}

export async function submitOnboardingApi(params: SubmitOnboardingParams, signal: AbortSignal) {
  const { token, form, template } = params
  const res = await fetch(`/api/v2/onboarding/invite/${token}/complete`, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json', 'ngrok-skip-browser-warning': '1' },
    body: JSON.stringify({
      nom: form.nom,
      subdomain: form.subdomain,
      adresse: form.adresse,
      ville: form.ville,
      region: form.region,
      telephone: form.telephone,
      logoBase64: form.logoBase64 || undefined,
      subsystem: form.subsystem,
      educationType: form.educationType,
      ownership: form.ownership,
      admissionType: form.admissionType,
      adminPrenom: form.adminPrenom,
      adminNom: form.adminNom,
      adminEmail: form.adminEmail,
      password: form.password,
      onboardingConfig: template
        ? buildOnboardingConfig(template, {
            niveaux1erCycle: form.niveaux1erCycle,
            classesParNiveau: form.classesParNiveau,
            conventionNommage: form.conventionNommage,
            lv2Debut: form.lv2Debut,
            lv2Disponibles: form.lv2Disponibles,
            niveaux2eCycle: form.niveaux2eCycle,
            filieres: form.filieres,
            a4Languages: form.a4Languages,
            classesParFiliere: form.classesParFiliere,
            niveauxPrimaire: form.niveauxPrimaire,
            classesParNiveauPrimaire: form.classesParNiveauPrimaire,
            maternelleSections: params.maternelleSections,
            nurseryLevels: params.nurseryLevels,
            filieresTechniques: form.filieresTechniques,
            sousTypeTechnique: params.sousTypeTechnique,
            cetifMode: params.cetifMode,
            sarMetiers: params.sarMetiers,
            cfmFilieres: params.cfmFilieres,
            enGradingSystem: params.enGradingSystem,
            enStreamStartLevel: params.enStreamStartLevel,
            bilingualEnLevels: params.bilingualEnLevels,
            bilingualEnFilieres: params.bilingualEnFilieres,
            hasPEBSFrancophone: params.hasPEBSFrancophone,
            hasPEBSAnglophone: params.hasPEBSAnglophone,
            bulletinFrequency: params.bulletinFrequency,
            evalSystemPrimaire: params.evalSystemPrimaire,
            appelFrequency: params.appelFrequency,
          })
        : undefined,
    }),
  })

  const text = await res.text()
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(`Réponse non-JSON (HTTP ${res.status}): ${text.slice(0, 100)}`)
  }
  if (typeof data !== 'object' || data === null || !('success' in data)) {
    throw new Error('Réponse invalide du serveur.')
  }
  const responseMessage = 'message' in data && typeof data.message === 'string' ? data.message : 'Erreur lors de la soumission.'
  if (data.success !== true) throw new Error(responseMessage)
  if ('data' in data && typeof data.data === 'object' && data.data !== null) {
    return data.data as { classCount?: number; subjectCount?: number; academicYear?: string }
  }
  return null
}
