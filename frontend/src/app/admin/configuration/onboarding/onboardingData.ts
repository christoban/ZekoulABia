import type React from 'react'
import { Baby, BookOpen, Book, GraduationCap, Wrench } from 'lucide-react'
import { GRILLE_HORAIRE_PAR_DEFAUT, type GrilleHoraireConfig } from '../timetableGridConfig'

export interface LV2OrgRule {
  level: string
  className?: string | null // null = règle pour tout le niveau (ex. VARIABLE)
  organisation: 'UNIFORME' | 'MIXTE' | 'VARIABLE'
  langue?: string | null // pour UNIFORME : la langue choisie
  langues?: string[] // pour MIXTE : les langues mélangées dans cette classe
}

export interface PEBSOrgRule {
  className: string
  level: string
  statut: 'PEBS_PUR' | 'NON_PEBS' | 'MIXTE'
}

export type GrilleHoraireOnboarding = GrilleHoraireConfig

export interface OnboardingState {
  schoolId: string
  schoolName?: string
  subSystem?: 'FRANCOPHONE' | 'ANGLOPHONE' | 'BILINGUAL'
  ownership?: string
  educationType?: string

  cycles: string[]
  template?: string
  series: string[] // séries francophones (A1..TI)
  anglophoneStreams: string[] // types de stream : ARTS, SCIENCES, COMMERCIAL
  anglophoneCombinations: string[] // codes combinaisons : A1..A5, S1..S4
  technicalFilieres: string[]
  primaryLevels: string[]

  lv2Active?: boolean
  lv2Languages: string[]
  lv2Organisation: LV2OrgRule[]
  classesPerLevel?: Record<string, number>
  conventionNommage?: string
  hasPEBSFrancophone?: boolean
  hasPEBSAnglophone?: boolean
  pebsOrganisation?: PEBSOrgRule[]

  academicYearStart?: string
  academicYearEnd?: string
  gridConfig: GrilleHoraireOnboarding
  periodsCount?: number
  sequencesPerPeriod?: number

  directionRoles: {
    proviseur?: string
    censeur?: string
    surveillantGeneral?: string
    intendant?: string
  }

  feesTypes: string[]
  paymentTranches?: number

  hasCanteen?: boolean
  hasTransport?: boolean
  hasLibrary?: boolean
  hasBoarding?: boolean

  // Politique d'admissions & inscriptions
  directAdmissionWithoutExam?: boolean
  capacityBufferPercent?: number
  selfServiceEnabled?: boolean
  adminGereInscriptions?: boolean
  defaultRecipient?: 'ELEVE' | 'PARENT' | 'LES_DEUX'
}

export interface OnboardingProps {
  schoolId: string
  schoolName: string
  subSystem?: 'FRANCOPHONE' | 'ANGLOPHONE' | 'BILINGUAL'
  ownership?: string
  educationType?: string
  /** Config déjà collectée en Phase 1 (formulaire d'inscription). Phase 2 s'en nourrit
   *  pour ne pas re-poser ces questions. */
  phase1Config?: Record<string, unknown> | null
  onComplete: (state: OnboardingState) => void
}

export interface AngloCombo {
  code: string
  type: string
  label: string
  coreSubjects: string[]
  subjects: string[]
}

export interface AngloStreamsData {
  arts: AngloCombo[]
  science: AngloCombo[]
}

export interface PebsAnalysisData {
  pebsOrganisation: PEBSOrgRule[]
  reformulation: string
  clarificationNeeded: boolean
  clarifications: string[]
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : []
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asBool(v: unknown): boolean {
  return v === true
}

function asNumberRecord(v: unknown): Record<string, number> | undefined {
  if (!v || typeof v !== 'object') return undefined
  const out: Record<string, number> = {}
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'number') out[k] = val
  }
  return Object.keys(out).length ? out : undefined
}

/**
 * Traduit l'onboardingConfig de la Phase 1 (formulaire d'inscription) vers l'état de la Phase 2.
 * Ne mappe que les données STRUCTURELLES fiables (cycles/séries/LV2/primaire/technique). Les
 * streams anglophones (représentation différente en Phase 1) restent redemandés par sécurité.
 */
export function mapPhase1ToState(cfg: Record<string, unknown> | null | undefined): Partial<OnboardingState> {
  if (!cfg || typeof cfg !== 'object') return {}

  const maternelleSections = asStringArray(cfg.maternelleSections)
  const niveauxPrimaire = asStringArray(cfg.niveauxPrimaire)
  const niveaux1erCycle = asStringArray(cfg.niveaux1erCycle)
  const niveaux2eCycle = asStringArray(cfg.niveaux2eCycle)
  const filieresTechniques = asStringArray(cfg.filieresTechniques)

  const cycles: string[] = []
  if (maternelleSections.length) cycles.push('MATERNELLE')
  if (niveauxPrimaire.length) cycles.push('PRIMAIRE')
  if (niveaux1erCycle.length) cycles.push('PREMIER_CYCLE')
  if (niveaux2eCycle.length) cycles.push('SECOND_CYCLE')
  if (filieresTechniques.length) cycles.push('TECHNIQUE')

  const lv2Languages = asStringArray(cfg.lv2Disponibles)
  const lv2Debut = asString(cfg.lv2Debut)
  const lv2Active =
    (lv2Debut !== undefined && lv2Debut !== '' && lv2Debut !== 'NON_APPLICABLE') || lv2Languages.length > 0

  const out: Partial<OnboardingState> = {}
  const templateCode = asString(cfg.templateCode)
  if (templateCode) out.template = templateCode
  if (cycles.length) out.cycles = cycles
  const filieres = asStringArray(cfg.filieres)
  if (filieres.length) out.series = filieres
  if (filieresTechniques.length) out.technicalFilieres = filieresTechniques
  if (niveauxPrimaire.length) out.primaryLevels = niveauxPrimaire
  if (lv2Languages.length) out.lv2Languages = lv2Languages
  if (cycles.length) out.lv2Active = lv2Active
  const classesParNiveau = asNumberRecord(cfg.classesParNiveau)
  if (classesParNiveau) out.classesPerLevel = classesParNiveau
  const conventionNommage = asString(cfg.conventionNommage)
  if (conventionNommage) out.conventionNommage = conventionNommage
  if (asBool(cfg.hasPEBSFrancophone)) out.hasPEBSFrancophone = true
  if (asBool(cfg.hasPEBSAnglophone)) out.hasPEBSAnglophone = true
  return out
}

export const CYCLE_KEYS = [
  { value: 'MATERNELLE', icon: Baby, key: 'phase2.cycles.maternelle' },
  { value: 'PRIMAIRE', icon: BookOpen, key: 'phase2.cycles.primaire' },
  { value: 'PREMIER_CYCLE', icon: Book, key: 'phase2.cycles.premierCycle' },
  { value: 'SECOND_CYCLE', icon: GraduationCap, key: 'phase2.cycles.secondCycle' },
  { value: 'TECHNIQUE', icon: Wrench, key: 'phase2.cycles.technique' },
]

export const SUBSYSTEM_KEYS = [
  { value: 'FRANCOPHONE', key: 'phase2.subsystem.francophone' },
  { value: 'ANGLOPHONE', key: 'phase2.subsystem.anglophone' },
  { value: 'BILINGUAL', key: 'phase2.subsystem.bilingual' },
]

export const SERIES_KEYS = [
  { value: 'A1', key: 'phase2.series.a1' },
  { value: 'A2', key: 'phase2.series.a2' },
  { value: 'A3', key: 'phase2.series.a3' },
  { value: 'A4', key: 'phase2.series.a4' },
  { value: 'C', key: 'phase2.series.c' },
  { value: 'D', key: 'phase2.series.d' },
  { value: 'E', key: 'phase2.series.e' },
  { value: 'TI', key: 'phase2.series.ti' },
  { value: 'SH', key: 'phase2.series.sh' },
  { value: 'AC', key: 'phase2.series.ac' },
]

export const ANGLO_STREAM_KEYS = [
  { value: 'ARTS', key: 'phase2.enStreams.arts' },
  { value: 'SCIENCES', key: 'phase2.enStreams.science' },
  { value: 'COMMERCIAL', key: 'phase2.enStreams.commercial' },
]

export const TECH_KEYS = [
  { value: 'F4', key: 'phase2.technical.f4' },
  { value: 'F3', key: 'phase2.technical.f3' },
  { value: 'F6', key: 'phase2.technical.f6' },
  { value: 'G', key: 'phase2.technical.g' },
  { value: 'INFO', key: 'phase2.technical.info' },
  { value: 'F8', key: 'phase2.technical.f8' },
]

export const PRIMARY_OPTIONS_FR = [
  { value: 'SIL', label: 'SIL' },
  { value: 'CP', label: 'CP' },
  { value: 'CE1', label: 'CE1' },
  { value: 'CE2', label: 'CE2' },
  { value: 'CM1', label: 'CM1' },
  { value: 'CM2', label: 'CM2' },
]

export const PRIMARY_OPTIONS_EN = [
  { value: 'Class 1', label: 'Class 1' },
  { value: 'Class 2', label: 'Class 2' },
  { value: 'Class 3', label: 'Class 3' },
  { value: 'Class 4', label: 'Class 4' },
  { value: 'Class 5', label: 'Class 5' },
  { value: 'Class 6', label: 'Class 6' },
]

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function generateClassName(level: string, index: number, convention: string): string {
  if (convention === 'CHIFFRES') return `${level} ${index + 1}`
  if (convention === 'MIXTE') return `${level} ${LETTERS[index]}1`
  return `${level} ${LETTERS[index]}` // LETTRES (default)
}

export function generateClassList(
  levels: string[],
  perLevel: Record<string, number> | undefined,
  convention: string,
): { level: string; className: string }[] {
  const conv = convention ?? 'LETTRES'
  const list: { level: string; className: string }[] = []
  for (const level of levels) {
    const count = perLevel?.[level] ?? 2
    for (let i = 0; i < Math.min(count, 26); i++) {
      list.push({ level, className: generateClassName(level, i, conv) })
    }
  }
  return list
}

export const LV2_LANG_KEYS = [
  { value: 'Allemand', key: 'phase2.lv2.allemand' },
  { value: 'Espagnol', key: 'phase2.lv2.espagnol' },
  { value: 'Arabe', key: 'phase2.lv2.arabe' },
  { value: 'Chinois', key: 'phase2.lv2.chinois' },
  { value: 'Italien', key: 'phase2.lv2.italien' },
]

export const FEES_KEYS = [
  { value: 'TUITION', key: 'phase2.fees.tuition' },
  { value: 'APEE_PTA', key: 'phase2.fees.apeePta' },
  { value: 'EXAM', key: 'phase2.fees.exam' },
  { value: 'UNIFORM', key: 'phase2.fees.uniform' },
  { value: 'INSCRIPTION', key: 'phase2.fees.inscription' },
  { value: 'CAUTION', key: 'phase2.fees.caution' },
  { value: 'DEVELOPMENT_LEVY', key: 'phase2.fees.developmentLevy' },
  { value: 'SPORTS_LEVY', key: 'phase2.fees.sportsLevy' },
]

export const TEMPLATE_LABELS: Record<string, string> = {
  LYCEE_FR: 'Lycée Francophone Public',
  PRIVE_FR: 'Établissement Privé Francophone',
  CES_FR: 'Collège d’Enseignement Secondaire (FR)',
  LYCEE_TECHNIQUE_FR: 'Lycée Technique Francophone',
  CETIC: 'CETIC',
  SAR_SM: 'SAR/SM',
  CFM: 'CFM',
  PRIMAIRE_FR: 'École Primaire Francophone',
  MATERNELLE_FR: 'École Maternelle Francophone',
  GHS_EN: 'Government High School (EN)',
  GSS_EN: 'Government Secondary School (EN)',
  PRIVE_EN: 'Private Anglophone School',
  GTC_GTHS_EN: 'Government Technical College & High School',
  GTC_EN: 'Government Technical College',
  PRIMARY_EN: 'Anglophone Primary School',
  NURSERY_EN: 'Anglophone Nursery School',
  LYCEE_BILINGUE: 'Lycée Bilingue',
  PRIMARY_BILINGUAL: 'École Primaire Bilingue',
  COMPLEXE_SCOLAIRE: 'Complexe Scolaire',
}

export function detectTemplate(state: OnboardingState): string {
  const c = state.cycles
  const isEN = state.subSystem === 'ANGLOPHONE'
  const isBil = state.subSystem === 'BILINGUAL'
  const isPrivate = (state.ownership ?? '').startsWith('PRIVATE')
  const has = (k: string) => c.includes(k)

  const hasSecondary = has('PREMIER_CYCLE') || has('SECOND_CYCLE')
  const hasPrimaryOrNursery = has('PRIMAIRE') || has('MATERNELLE')

  // Anglophone technique (GTC_EN/GTC_GTHS_EN) — même signal has('SECOND_CYCLE') que la
  // distinction GHS_EN/GSS_EN plus bas, doit être vérifié AVANT le fallback francophone.
  if (has('TECHNIQUE') && isEN) return has('SECOND_CYCLE') ? 'GTC_GTHS_EN' : 'GTC_EN'
  if (has('TECHNIQUE')) return 'LYCEE_TECHNIQUE_FR'
  if (hasSecondary && hasPrimaryOrNursery) return 'COMPLEXE_SCOLAIRE'

  if (has('MATERNELLE') && !has('PRIMAIRE') && !hasSecondary) return isEN ? 'NURSERY_EN' : 'MATERNELLE_FR'
  if (has('PRIMAIRE') && !hasSecondary) return isBil ? 'PRIMARY_BILINGUAL' : isEN ? 'PRIMARY_EN' : 'PRIMAIRE_FR'

  if (isBil && hasSecondary) return 'LYCEE_BILINGUE'
  if (isEN && hasSecondary) return isPrivate ? 'PRIVE_EN' : has('SECOND_CYCLE') ? 'GHS_EN' : 'GSS_EN'
  if (isPrivate) return 'PRIVE_FR'
  if (has('SECOND_CYCLE')) return 'LYCEE_FR'
  return 'CES_FR'
}

export const ONBOARDING_STYLES = {
  card: {
    background: 'var(--surface)',
    border: '1.5px solid var(--border)',
    borderRadius: 18,
    padding: '24px 22px',
    width: '100%',
    maxWidth: 560,
    maxHeight: 'calc(100vh - 160px)',
    overflowY: 'auto',
    boxShadow: '0 4px 24px rgba(26,46,30,0.07)',
  } as React.CSSProperties,
  bubble: {
    background: 'var(--green-light)',
    border: '1.5px solid rgba(142,42,58,0.18)',
    borderRadius: 14,
    padding: '14px 16px',
    fontSize: 15,
    color: 'var(--text)',
    lineHeight: 1.55,
    marginBottom: 18,
  } as React.CSSProperties,
  opt: (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '13px 15px',
    borderRadius: 12,
    cursor: 'pointer',
    border: `1.5px solid ${active ? 'var(--green)' : 'var(--border)'}`,
    background: active ? 'var(--green-light)' : 'var(--surface)',
    fontSize: 14.5,
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: 9,
    transition: 'all 0.12s',
    textAlign: 'left',
    width: '100%',
  }),
  primary: {
    background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
    color: 'var(--surface)',
    border: 'none',
    borderRadius: 11,
    padding: '13px 22px',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  secondary: {
    background: 'var(--surface)',
    color: 'var(--text2)',
    border: '1.5px solid var(--border2)',
    borderRadius: 11,
    padding: '13px 20px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '12px 14px',
    borderRadius: 10,
    fontSize: 14.5,
    border: '1.5px solid var(--border)',
    color: 'var(--text)',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    outline: 'none',
    marginBottom: 10,
  } as React.CSSProperties,
  label: {
    fontSize: 12.5,
    fontWeight: 700,
    color: 'var(--text3)',
    marginBottom: 5,
    marginTop: 4,
  } as React.CSSProperties,
}

export function createInitialOnboardingState(p: OnboardingProps): OnboardingState {
  return {
    schoolId: p.schoolId,
    schoolName: p.schoolName,
    subSystem: p.subSystem,
    ownership: p.ownership,
    educationType: p.educationType,
    cycles: [],
    series: [],
    anglophoneStreams: [],
    anglophoneCombinations: [],
    technicalFilieres: [],
    primaryLevels: [],
    lv2Languages: [],
    lv2Organisation: [],
    directionRoles: {},
    feesTypes: [],
    periodsCount: 3,
    sequencesPerPeriod: 2,
    paymentTranches: 3,
    academicYearStart: `${new Date().getFullYear()}-09-05`,
    gridConfig: { ...GRILLE_HORAIRE_PAR_DEFAUT, joursActifs: [...GRILLE_HORAIRE_PAR_DEFAUT.joursActifs] },
    directAdmissionWithoutExam: true,
    capacityBufferPercent: 0,
    selfServiceEnabled: true,
    adminGereInscriptions: true,
    defaultRecipient: 'ELEVE',
    // Pré-remplissage depuis la Phase 1 (écrase les valeurs vides ci-dessus).
    ...mapPhase1ToState(p.phase1Config),
  }
}
