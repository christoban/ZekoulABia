export type LoadState = 'loading' | 'valid' | 'invalid' | 'expired' | 'used'
export type Step = 1 | 2 | 3 | 4 | 5

export interface InviteData {
  schoolName: string
  email: string
  plan: string
  notes: string | null
}

export interface PreviewData {
  classes: { name: string; level: string; section: string }[]
  totalClasses: number
  subjects: string[]
}

export interface FormData {
  // Step 1 — École
  nom: string
  subdomain: string
  subsystem: string
  educationType: string
  ownership: string
  // Uniquement pertinent pour educationType=TECHNICAL (GGTC/CETIF partagent le
  // même programme que la variante mixte, seule l'admission diffère).
  admissionType: string
  ville: string
  region: string
  telephone: string
  adresse: string
  logoBase64: string
  // Step 2 — Admin
  adminPrenom: string
  adminNom: string
  adminEmail: string
  password: string
  confirmPassword: string
  // Step 3 — Configuration étendue
  niveaux1erCycle: string[]
  classesParNiveau: Record<string, number>
  conventionNommage: string
  lv2Debut: string
  lv2Disponibles: string[]
  niveaux2eCycle: string[]
  filieres: string[]
  a4Languages: string[]
  classesParFiliere: string
  filieresTechniques: string[]
  niveauxPrimaire: string[]
  classesParNiveauPrimaire: Record<string, number>
}

export type TechnicalSubtype = 'IND' | 'STT' | 'MIXTE' | ''
export type EnGradingSystem = 'OVER_20' | 'OVER_100' | ''
export type BulletinFrequency = 'MONTHLY' | 'TRIMESTRIAL'
export type EvalSystemPrimaire = 'APC_300' | 'NOTES_20' | ''
export type AppelFrequency = 'TWICE' | 'ONCE' | ''
export type EnStreamStartLevel = 'FORM4' | 'FORM5' | 'SIXTH' | ''
