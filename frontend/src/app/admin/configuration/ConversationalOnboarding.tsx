'use client'

/**
 * Onboarding conversationnel — Phase 2
 * Questionnaire IA (chat + options) qui collecte l'OnboardingState, affiche un récapitulatif,
 * puis délègue l'exécution déterministe au backend (POST /api/v2/onboarding/execute).
 *
 * Groq n'est PAS appelé pour construire l'établissement : les coefficients MINESEC restent
 * déterministes côté serveur. Le questionnaire reste utilisable sur mobile (375px).
 */

import { useEffect, useMemo, useState } from 'react'
import { Baby, BookOpen, Book, GraduationCap, Wrench, Check, XCircle, HelpCircle, BarChart3, Languages, Landmark, Calendar, Wallet, Users, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { fetchApi } from '@/lib/fetchApi'
import { useT, useChangeLanguage, useLanguage } from '@/lib/i18n'

// ── Types ────────────────────────────────────────────────────────────────────
export interface LV2OrgRule {
  level: string
  className?: string | null   // null = règle pour tout le niveau (ex. VARIABLE)
  organisation: 'UNIFORME' | 'MIXTE' | 'VARIABLE'
  langue?: string | null       // pour UNIFORME : la langue choisie
  langues?: string[]           // pour MIXTE : les langues mélangées dans cette classe
}

export interface PEBSOrgRule {
  className: string
  level: string
  statut: 'PEBS_PUR' | 'NON_PEBS' | 'MIXTE'
}

export interface OnboardingState {
  schoolId: string
  schoolName?: string
  subSystem?: 'FRANCOPHONE' | 'ANGLOPHONE' | 'BILINGUAL'
  ownership?: string
  educationType?: string

  cycles: string[]
  template?: string
  series: string[]                  // séries francophones (A1..TI)
  anglophoneStreams: string[]       // types de stream : ARTS, SCIENCES, COMMERCIAL
  anglophoneCombinations: string[]  // codes combinaisons : A1..A5, S1..S4
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

interface Props {
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
function mapPhase1ToState(cfg: Record<string, unknown> | null | undefined): Partial<OnboardingState> {
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

// ── Key mappings for i18n ─────────────────────────────────────────────────────
const CYCLE_KEYS = [
  { value: 'MATERNELLE', icon: Baby, key: 'phase2.cycles.maternelle' },
  { value: 'PRIMAIRE', icon: BookOpen, key: 'phase2.cycles.primaire' },
  { value: 'PREMIER_CYCLE', icon: Book, key: 'phase2.cycles.premierCycle' },
  { value: 'SECOND_CYCLE', icon: GraduationCap, key: 'phase2.cycles.secondCycle' },
  { value: 'TECHNIQUE', icon: Wrench, key: 'phase2.cycles.technique' },
]

const SUBSYSTEM_KEYS = [
  { value: 'FRANCOPHONE', key: 'phase2.subsystem.francophone' },
  { value: 'ANGLOPHONE', key: 'phase2.subsystem.anglophone' },
  { value: 'BILINGUAL', key: 'phase2.subsystem.bilingual' },
]

const SERIES_KEYS = [
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

// Sous-système anglophone (GCE Board) : streams + combinaisons de matières (P3)
const ANGLO_STREAM_KEYS = [
  { value: 'ARTS', key: 'phase2.enStreams.arts' },
  { value: 'SCIENCES', key: 'phase2.enStreams.science' },
  { value: 'COMMERCIAL', key: 'phase2.enStreams.commercial' },
]

// Les combinaisons (A1-A5 / S1-S…) NE SONT PLUS figées ici : elles proviennent de
// GET /api/v2/onboarding/anglophone-streams (source unique = AnglophoneStreamCombination).
interface AngloCombo { code: string; type: string; label: string; coreSubjects: string[]; subjects: string[] }
interface AngloStreamsData { arts: AngloCombo[]; science: AngloCombo[] }

const TECH_KEYS = [
  { value: 'F4', key: 'phase2.technical.f4' },
  { value: 'F3', key: 'phase2.technical.f3' },
  { value: 'F6', key: 'phase2.technical.f6' },
  { value: 'G', key: 'phase2.technical.g' },
  { value: 'INFO', key: 'phase2.technical.info' },
  { value: 'F8', key: 'phase2.technical.f8' },
]

const PRIMARY_OPTIONS_FR = [
  { value: 'SIL', label: 'SIL' },
  { value: 'CP', label: 'CP' },
  { value: 'CE1', label: 'CE1' },
  { value: 'CE2', label: 'CE2' },
  { value: 'CM1', label: 'CM1' },
  { value: 'CM2', label: 'CM2' },
]
const PRIMARY_OPTIONS_EN = [
  { value: 'Class 1', label: 'Class 1' },
  { value: 'Class 2', label: 'Class 2' },
  { value: 'Class 3', label: 'Class 3' },
  { value: 'Class 4', label: 'Class 4' },
  { value: 'Class 5', label: 'Class 5' },
  { value: 'Class 6', label: 'Class 6' },
]

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

function generateClassName(level: string, index: number, convention: string): string {
  if (convention === 'CHIFFRES') return `${level} ${index + 1}`
  if (convention === 'MIXTE') return `${level} ${LETTERS[index]}1`
  return `${level} ${LETTERS[index]}` // LETTRES (default)
}

function generateClassList(levels: string[], perLevel: Record<string, number> | undefined, convention: string): { level: string; className: string }[] {
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

const LV2_LANG_KEYS = [
  { value: 'Allemand', key: 'phase2.lv2.allemand' },
  { value: 'Espagnol', key: 'phase2.lv2.espagnol' },
  { value: 'Arabe', key: 'phase2.lv2.arabe' },
  { value: 'Chinois', key: 'phase2.lv2.chinois' },
  { value: 'Italien', key: 'phase2.lv2.italien' },
]


const FEES_KEYS = [
  { value: 'TUITION', key: 'phase2.fees.tuition' },
  { value: 'APEE_PTA', key: 'phase2.fees.apeePta' },
  { value: 'EXAM', key: 'phase2.fees.exam' },
  { value: 'UNIFORM', key: 'phase2.fees.uniform' },
  { value: 'INSCRIPTION', key: 'phase2.fees.inscription' },
  { value: 'CAUTION', key: 'phase2.fees.caution' },
  { value: 'DEVELOPMENT_LEVY', key: 'phase2.fees.developmentLevy' },
  { value: 'SPORTS_LEVY', key: 'phase2.fees.sportsLevy' },
]

const TEMPLATE_LABELS: Record<string, string> = {
  LYCEE_FR: 'Lycée Francophone Public', PRIVE_FR: 'Établissement Privé Francophone', CES_FR: 'Collège d’Enseignement Secondaire (FR)',
  LYCEE_TECHNIQUE_FR: 'Lycée Technique Francophone', CETIC: 'CETIC', SAR_SM: 'SAR/SM', CFM: 'CFM',
  PRIMAIRE_FR: 'École Primaire Francophone', MATERNELLE_FR: 'École Maternelle Francophone',
  GHS_EN: 'Government High School (EN)', GSS_EN: 'Government Secondary School (EN)', PRIVE_EN: 'Private Anglophone School',
  GTC_GTHS_EN: 'Government Technical College & High School', GTC_EN: 'Government Technical College',
  PRIMARY_EN: 'Anglophone Primary School', NURSERY_EN: 'Anglophone Nursery School',
  LYCEE_BILINGUE: 'Lycée Bilingue', PRIMARY_BILINGUAL: 'École Primaire Bilingue', COMPLEXE_SCOLAIRE: 'Complexe Scolaire',
}

const SECONDARY_LEVELS_FR = ['6e', '5e', '4e', '3e', '2nde', '1ère', 'Tle']

// ── Détection déterministe du template ───────────────────────────────────────
function detectTemplate(state: OnboardingState): string {
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
  // Francophone secondaire
  if (isPrivate) return 'PRIVE_FR'
  if (has('SECOND_CYCLE')) return 'LYCEE_FR'
  return 'CES_FR'
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  card: { background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 18, padding: '24px 22px', width: '100%', maxWidth: 560, maxHeight: 'calc(100vh - 160px)', overflowY: 'auto', boxShadow: '0 4px 24px rgba(26,46,30,0.07)' } as React.CSSProperties,
  bubble: { background: 'var(--green-light)', border: '1.5px solid rgba(142,42,58,0.18)', borderRadius: 14, padding: '14px 16px', fontSize: 15, color: 'var(--text)', lineHeight: 1.55, marginBottom: 18 } as React.CSSProperties,
  opt: (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderRadius: 12, cursor: 'pointer',
    border: `1.5px solid ${active ? 'var(--green)' : 'var(--border)'}`, background: active ? 'var(--green-light)' : 'var(--surface)',
    fontSize: 14.5, fontWeight: 600, color: 'var(--text)', marginBottom: 9, transition: 'all 0.12s', textAlign: 'left', width: '100%',
  }),
  primary: { background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'var(--surface)', border: 'none', borderRadius: 11, padding: '13px 22px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  secondary: { background: 'var(--surface)', color: 'var(--text2)', border: '1.5px solid var(--border2)', borderRadius: 11, padding: '13px 20px', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  input: { width: '100%', padding: '12px 14px', borderRadius: 10, fontSize: 14.5, border: '1.5px solid var(--border)', color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', marginBottom: 10 } as React.CSSProperties,
  label: { fontSize: 12.5, fontWeight: 700, color: 'var(--text3)', marginBottom: 5, marginTop: 4 } as React.CSSProperties,
}

const INITIAL = (p: Props): OnboardingState => ({
  schoolId: p.schoolId, schoolName: p.schoolName, subSystem: p.subSystem, ownership: p.ownership, educationType: p.educationType,
  cycles: [], series: [], anglophoneStreams: [], anglophoneCombinations: [], technicalFilieres: [], primaryLevels: [],
  lv2Languages: [], lv2Organisation: [], directionRoles: {}, feesTypes: [],
  periodsCount: 3, sequencesPerPeriod: 2, paymentTranches: 3,
  academicYearStart: `${new Date().getFullYear()}-09-05`,
  directAdmissionWithoutExam: true,
  capacityBufferPercent: 0,
  selfServiceEnabled: true,
  adminGereInscriptions: true,
  defaultRecipient: 'ELEVE',
  // Pré-remplissage depuis la Phase 1 (écrase les valeurs vides ci-dessus).
  ...mapPhase1ToState(p.phase1Config),
})

export default function ConversationalOnboarding(props: Props) {
  const t = useT('onboarding')
  const changeLanguage = useChangeLanguage()
  const { lang } = useLanguage()
  const [state, setState] = useState<OnboardingState>(() => INITIAL(props))
  const [idx, setIdx] = useState(0)
  const [angloCombos, setAngloCombos] = useState<AngloStreamsData | null>(null)
  const [angloState, setAngloState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [pebsDescription, setPebsDescription] = useState('')
  const [pebsAnalysis, setPebsAnalysis] = useState<{ pebsOrganisation: PEBSOrgRule[]; reformulation: string; clarificationNeeded: boolean; clarifications: string[] } | null>(null)
  const [pebsLoading, setPebsLoading] = useState(false)
  const [pebsError, setPebsError] = useState('')
  const [pebsConversation, setPebsConversation] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])

  // Réconciliation : true si la Phase 1 (inscription) a déjà fourni la structure. On saute alors
  // les questions déjà répondues. Immuable (basé sur les props) → ne perturbe pas la navigation.
  const reconciled = useMemo(() => (mapPhase1ToState(props.phase1Config).cycles?.length ?? 0) > 0, [props.phase1Config])

  const cycleOptions = useMemo(() => CYCLE_KEYS.map(c => ({ value: c.value, icon: c.icon, label: t(c.key) })), [t])
  const subsystemOptions = useMemo(() => SUBSYSTEM_KEYS.map(s => ({ value: s.value, label: t(s.key) })), [t])
  const seriesOptions = useMemo(() => SERIES_KEYS.map(s => ({ value: s.value, label: t(s.key) })), [t])
  const angloStreamOptions = useMemo(() => ANGLO_STREAM_KEYS.map(a => ({ value: a.value, label: t(a.key) })), [t])
  const techOptions = useMemo(() => TECH_KEYS.map(tc => ({ value: tc.value, label: t(tc.key) })), [t])
  const lv2LangOptions = useMemo(() => LV2_LANG_KEYS.map(l => ({ value: l.value, label: t(l.key) })), [t])
  const feesOptions = useMemo(() => FEES_KEYS.map(f => ({ value: f.value, label: t(f.key) })), [t])

  const loadAngloCombos = () => {
    setAngloState('loading')
    fetchApi('/api/v2/onboarding/anglophone-streams', { credentials: 'include' })
      .then(r => r.json())
      .then(d => {
        if (!d?.success || !d.data) throw new Error('bad response')
        setAngloCombos(d.data as AngloStreamsData)
        setAngloState('ready')
      })
      .catch(() => setAngloState('error'))
  }

  const patch = (p: Partial<OnboardingState>) => setState(s => {
    if (p.subSystem && p.subSystem !== s.subSystem) {
      changeLanguage(p.subSystem === 'ANGLOPHONE' ? 'en' : 'fr')
    }
    return { ...s, ...p }
  })
  const toggleIn = (key: keyof OnboardingState, value: string) => {
    setState(s => {
      const arr = (s[key] as string[]) ?? []
      const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
      return { ...s, [key]: next }
    })
  }

  // Liste dynamique des étapes selon l'état
  const steps = useMemo<string[]>(() => {
    const list = ['intro']
    // Structure : posée seulement si la Phase 1 ne l'a pas déjà fournie.
    if (!reconciled) {
      list.push('cycles')
      if (!state.subSystem) list.push('subsystem')
      list.push('templateConfirm')
    }
    if (state.cycles.includes('SECOND_CYCLE')) {
      const sys = state.subSystem
      // Francophone / Bilingue → séries FR (sautées si Phase 1 les a fournies)
      if ((sys === 'FRANCOPHONE' || sys === 'BILINGUAL' || !sys) && !reconciled) list.push('series')
      // Anglophone / Bilingue → streams EN (mapping Phase 1 non fiable → toujours redemandés)
      if (sys === 'ANGLOPHONE' || sys === 'BILINGUAL') {
        list.push('enStreams')
        if (state.anglophoneStreams.length > 0) list.push('enCombos')
      }
    }
    if (state.cycles.includes('TECHNIQUE') && !reconciled) list.push('technical')
    if (state.cycles.includes('PRIMAIRE') && !reconciled) list.push('primaryLevels')
    const hasSecondary = state.cycles.includes('PREMIER_CYCLE') || state.cycles.includes('SECOND_CYCLE')
    // LV2 générique : concerne uniquement le premier cycle (4e/3e). Au 2nd cycle, la LV2 est
    // portée par les séries A (A4…), configurées ailleurs. Un seul écran : la LV2 se règle
    // directement classe par classe (chaque classe = une langue, ou « mélangée »).
    if (state.cycles.includes('PREMIER_CYCLE')) {
      if (!reconciled) list.push('lv2Active')
      if (state.lv2Active) {
        if (!reconciled) list.push('lv2Languages')
        list.push('lv2PerLevel')
      }
    }
    if (hasSecondary && (state.hasPEBSFrancophone || state.hasPEBSAnglophone)) {
      list.push('pebsOrg')
    }
    list.push('calYear', 'periods', 'sequences', 'fees', 'tranches', 'services', 'direction', 'admissions', 'recap')
    return list
  }, [reconciled, state.subSystem, state.cycles, state.lv2Active, state.lv2Organisation, state.anglophoneStreams, state.hasPEBSFrancophone, state.hasPEBSAnglophone])

  const stepKey = steps[Math.min(idx, steps.length - 1)]
  const goNext = () => setIdx(i => Math.min(i + 1, steps.length - 1))
  const goBack = () => setIdx(i => Math.max(i - 1, 0))

  // Charger les combinaisons anglophones depuis la base quand le bloc anglophone est atteint
  useEffect(() => {
    if ((stepKey === 'enStreams' || stepKey === 'enCombos') && angloState === 'idle') {
      loadAngloCombos()
    }
  }, [stepKey, angloState])

  // Niveaux concernés par le PEBS : TOUT le premier cycle (6e→3e), car le programme bilingue
  // spécial démarre dès la 6e — plus le second cycle (série ABI) le cas échéant.
  const concernedLevels = useMemo(() => {
    const lv: string[] = []
    if (state.cycles.includes('PREMIER_CYCLE')) lv.push('6e', '5e', '4e', '3e')
    if (state.cycles.includes('SECOND_CYCLE')) lv.push('2nde', '1ère', 'Tle')
    return lv
  }, [state.cycles])

  // Niveaux concernés par la LV2 générique : 4e/3e uniquement (jamais 6e/5e ni 2nd cycle).
  // (Le curriculum MINESEC place la LV2 en 4e/3e ; au 2nd cycle c'est la série A qui la porte.)
  const lv2Levels = useMemo(
    () => (state.cycles.includes('PREMIER_CYCLE') ? ['4e', '3e'] : []),
    [state.cycles],
  )

  const setPerClass = (level: string, className: string, patchRule: Partial<LV2OrgRule>) => {
    setState(s => {
      const others = s.lv2Organisation.filter(o => !(o.level === level && o.className === className))
      const current = s.lv2Organisation.find(o => o.level === level && o.className === className)
        ?? { level, className, organisation: 'UNIFORME' as const }
      return { ...s, lv2Organisation: [...others, { ...current, ...patchRule }] }
    })
  }

  // ── Rendu par étape ─────────────────────────────────────────────────────────
  const Bubble = ({ children }: { children: React.ReactNode }) => <div style={S.bubble}>{children}</div>
  const Nav = ({ nextLabel, canNext = true, onNext = goNext }: { nextLabel?: string; canNext?: boolean; onNext?: () => void }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, gap: 10 }}>
      <button style={S.secondary} onClick={goBack} disabled={idx === 0}>{t('phase2.nav.back')}</button>
      <button style={{ ...S.primary, opacity: canNext ? 1 : 0.5 }} onClick={onNext} disabled={!canNext}>{nextLabel ?? t('phase2.nav.continue')}</button>
    </div>
  )

  const progress = Math.round((idx / (steps.length - 1)) * 100)

  const detectedTemplate = useMemo(() => detectTemplate(state), [state])

  function renderStep() {
    switch (stepKey) {
      case 'intro':
        return (
          <>
            <Bubble><span style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: t('phase2.intro.bubble', { schoolName: state.schoolName ?? '' }) }} /></Bubble>
            {reconciled && <Bubble>{t('phase2.intro.reconciled')}</Bubble>}
            <button style={{ ...S.primary, width: '100%' }} onClick={goNext}>{t('phase2.intro.start')}</button>
          </>
        )

      case 'cycles':
        return (
          <>
            <Bubble>{t('phase2.cycles.title')}</Bubble>
            {cycleOptions.map(o => (
              <button key={o.value} style={S.opt(state.cycles.includes(o.value))} onClick={() => toggleIn('cycles', o.value)}>
                <span style={{ display: 'flex', alignItems: 'center' }}><o.icon size={20} /></span>
                <span style={{ flex: 1 }}>{o.label}</span>
                {state.cycles.includes(o.value) && <Check size={16} color="var(--green)" strokeWidth={3} />}
              </button>
            ))}
            <Nav canNext={state.cycles.length > 0} />
          </>
        )

      case 'subsystem':
        return (
          <>
            <Bubble>{t('phase2.subsystem.title')}</Bubble>
            {subsystemOptions.map(o => (
              <button key={o.value} style={S.opt(state.subSystem === o.value)} onClick={() => patch({ subSystem: o.value as OnboardingState['subSystem'] })}>
                <span style={{ flex: 1 }}>{o.label}</span>
                {state.subSystem === o.value && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
              </button>
            ))}
            <Nav canNext={!!state.subSystem} />
          </>
        )

      case 'templateConfirm':
        return (
          <>
            <Bubble><div style={{ display: 'contents' }} dangerouslySetInnerHTML={{ __html: t('phase2.template.bubble', { template: TEMPLATE_LABELS[detectedTemplate] ?? detectedTemplate }) }} /></Bubble>
            <button style={S.opt(state.template === detectedTemplate)} onClick={() => { patch({ template: detectedTemplate }); goNext() }}>
              <span style={{ flex: 1 }}>{t('phase2.template.yes')}</span>
            </button>
            <button style={S.opt(false)} onClick={() => { patch({ template: detectedTemplate }); goNext() }}>
              <span style={{ flex: 1 }}>{t('phase2.template.later')}</span>
            </button>
            <Nav onNext={() => { patch({ template: detectedTemplate }); goNext() }} />
          </>
        )

      case 'series':
        return (
          <>
            <Bubble>{t('phase2.series.title')}</Bubble>
            {seriesOptions.map(o => (
              <button key={o.value} style={S.opt(state.series.includes(o.value))} onClick={() => toggleIn('series', o.value)}>
                <span style={{ flex: 1 }}>{o.label}</span>
                {state.series.includes(o.value) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
              </button>
            ))}
            <div style={{ fontSize: 13, color: 'var(--amber)', background: 'var(--amber-light)', border: '1px solid var(--amber)', borderRadius: 9, padding: '9px 12px', marginTop: 4 }}>
              {t('phase2.series.note')}
            </div>
            <Nav canNext={state.series.length > 0} />
          </>
        )

      case 'enStreams':
        return (
          <>
            <Bubble>
              {state.subSystem === 'BILINGUAL' ? t('phase2.enStreams.titleBilingual') : t('phase2.enStreams.title')}
            </Bubble>
            {angloStreamOptions.map(o => (
              <button key={o.value} style={S.opt(state.anglophoneStreams.includes(o.value))} onClick={() => toggleIn('anglophoneStreams', o.value)}>
                <span style={{ flex: 1 }}>{o.label}</span>
                {state.anglophoneStreams.includes(o.value) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
              </button>
            ))}
            <Nav canNext={state.anglophoneStreams.length > 0} />
          </>
        )

      case 'enCombos': {
        const showArts = state.anglophoneStreams.includes('ARTS') || state.anglophoneStreams.includes('COMMERCIAL')
        const showSci = state.anglophoneStreams.includes('SCIENCES')
        const combos: AngloCombo[] = angloCombos
          ? [...(showArts ? angloCombos.arts : []), ...(showSci ? angloCombos.science : [])]
          : []
        return (
          <>
            <Bubble>
              {t('phase2.enCombos.title')}
            </Bubble>

            {angloState === 'loading' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 4px', color: 'var(--text3)', fontSize: 14 }}>
                <div style={{ width: 20, height: 20, border: '3px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite', flexShrink: 0 }} />
                {t('phase2.enCombos.loading')}
                <style>{`@keyframes edu-spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            )}

            {angloState === 'error' && (
              <div style={{ background: 'var(--red-light)', border: '1.5px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 6 }}>
                <div style={{ color: 'var(--red)', fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{t('phase2.enCombos.error')}</div>
                <button style={{ ...S.secondary, padding: '8px 16px', fontSize: 14 }} onClick={loadAngloCombos}>{t('phase2.enCombos.retry')}</button>
              </div>
            )}

            {angloState === 'ready' && combos.map(c => (
              <button key={c.code} style={S.opt(state.anglophoneCombinations.includes(c.code))} onClick={() => toggleIn('anglophoneCombinations', c.code)}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{c.code} — {c.label}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--text3)', fontWeight: 500 }}>{c.subjects.join(', ')}</div>
                </div>
                {state.anglophoneCombinations.includes(c.code) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
              </button>
            ))}

            <div style={{ fontSize: 13, color: 'var(--blue)', background: 'var(--blue-light)', border: '1px solid var(--blue-light)', borderRadius: 9, padding: '9px 12px', marginTop: 4 }}>
              {t('phase2.enCombos.info')}
            </div>
            <Nav />
          </>
        )
      }

      case 'technical':
        return (
          <>
            <Bubble>{t('phase2.technical.title')}</Bubble>
            {techOptions.map(o => (
              <button key={o.value} style={S.opt(state.technicalFilieres.includes(o.value))} onClick={() => toggleIn('technicalFilieres', o.value)}>
                <span style={{ flex: 1 }}>{o.label}</span>
                {state.technicalFilieres.includes(o.value) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
              </button>
            ))}
            <Nav canNext={state.technicalFilieres.length > 0} />
          </>
        )

      case 'primaryLevels': {
        const opts = state.subSystem === 'ANGLOPHONE' ? PRIMARY_OPTIONS_EN : PRIMARY_OPTIONS_FR
        return (
          <>
            <Bubble>{t('phase2.primaryLevels.title')}</Bubble>
            {opts.map(o => (
              <button key={o.value} style={S.opt(state.primaryLevels.includes(o.value))} onClick={() => toggleIn('primaryLevels', o.value)}>
                <span style={{ flex: 1 }}>{o.label}</span>
                {state.primaryLevels.includes(o.value) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
              </button>
            ))}
            <Nav canNext={state.primaryLevels.length > 0} />
          </>
        )
      }

      case 'lv2Active':
        return (
          <>
            <Bubble>{t('phase2.lv2.activeTitle')}</Bubble>
            <button style={S.opt(state.lv2Active === true)} onClick={() => patch({ lv2Active: true })}><span style={{ flex: 1 }}>{t('phase2.lv2.yes')}</span></button>
            <button style={S.opt(state.lv2Active === false)} onClick={() => patch({ lv2Active: false })}><span style={{ flex: 1 }}>{t('phase2.lv2.no')}</span></button>
            <Nav canNext={state.lv2Active !== undefined} />
          </>
        )

      case 'lv2Languages':
        return (
          <>
            <Bubble>{t('phase2.lv2.languagesTitle')}</Bubble>
            {lv2LangOptions.map(l => (
              <button key={l.value} style={S.opt(state.lv2Languages.includes(l.value))} onClick={() => toggleIn('lv2Languages', l.value)}>
                <span style={{ flex: 1 }}>{l.label}</span>
                {state.lv2Languages.includes(l.value) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
              </button>
            ))}
            <Nav canNext={state.lv2Languages.length > 0} />
          </>
        )

      case 'lv2PerLevel': {
        // Un seul écran : chaque classe reçoit UNE langue (menu déroulant), ou passe en
        // « Mélangée » pour cocher plusieurs langues. La donnée produite est toujours
        // par classe (className) → le backend crée un ClassSubjectOverride par langue réelle.
        const lv2ClassNames = lv2Levels.flatMap(level => {
          const count = state.classesPerLevel?.[level] ?? 2
          const convention = state.conventionNommage ?? 'LETTRES'
          return Array.from({ length: count }, (_, i) => generateClassName(level, i, convention))
        })
        const lv2Complete = lv2ClassNames.length > 0 && lv2ClassNames.every(cn => {
          const r = state.lv2Organisation.find(o => o.className === cn)
          if (!r) return false
          return r.organisation === 'MIXTE' ? (r.langues?.length ?? 0) > 0 : !!r.langue
        })
        return (
          <>
            <Bubble>{t('phase2.lv2.perClassTitle')}</Bubble>
            {lv2Levels.map(level => {
              const count = state.classesPerLevel?.[level] ?? 2
              const convention = state.conventionNommage ?? 'LETTRES'
              return (
                <div key={level} style={{ border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 14px', marginBottom: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', marginBottom: 10 }}>{level}</div>
                  {Array.from({ length: count }, (_, i) => {
                    const cn = generateClassName(level, i, convention)
                    const rule = state.lv2Organisation.find(o => o.className === cn)
                    const isMixte = rule?.organisation === 'MIXTE'
                    return (
                      <div key={cn} style={{ background: 'var(--bg)', borderRadius: 10, padding: '10px 12px', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', minWidth: 54 }}>{cn}</div>
                          {!isMixte && (
                            <select style={{ ...S.input, marginBottom: 0, flex: 1, minWidth: 140 }} value={rule?.langue ?? ''}
                              onChange={e => setPerClass(level, cn, { organisation: 'UNIFORME', langue: e.target.value, langues: undefined })}>
                              <option value="">{t('phase2.lv2.chooseLang')}</option>
                              {state.lv2Languages.map(l => <option key={l} value={l}>{t(`phase2.lv2.${l.toLowerCase()}`) ?? l}</option>)}
                            </select>
                          )}
                          <button style={{ ...S.opt(isMixte), width: 'auto', marginBottom: 0, padding: '7px 12px', fontSize: 13 }}
                            onClick={() => isMixte
                              ? setPerClass(level, cn, { organisation: 'UNIFORME', langues: undefined })
                              : setPerClass(level, cn, { organisation: 'MIXTE', langue: undefined, langues: [] })}>
                            {isMixte ? t('phase2.lv2.singleLangBack') : t('phase2.lv2.mixteClass')}
                          </button>
                        </div>
                        {isMixte && (
                          <div style={{ marginTop: 8 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }}>{t('phase2.lv2.mixedLanguages')}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                              {state.lv2Languages.map(l => {
                                const active = rule?.langues?.includes(l) ?? false
                                return (
                                  <button key={l} style={{
                                    padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                                    border: `1.5px solid ${active ? 'var(--green)' : 'var(--border)'}`,
                                    background: active ? 'var(--green-light)' : 'var(--surface)',
                                    color: active ? 'var(--green2)' : 'var(--text2)',
                                  }}
                                    onClick={() => {
                                      const next = active
                                        ? (rule?.langues ?? []).filter(x => x !== l)
                                        : [...(rule?.langues ?? []), l]
                                      setPerClass(level, cn, { langues: next })
                                    }}>
                                    {active && <Check size={13} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                                    {t(`phase2.lv2.${l.toLowerCase()}`) ?? l}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })}
            <Nav canNext={lv2Complete} />
          </>
        )
      }

      case 'pebsOrg': {
        const hasPEBS = state.hasPEBSFrancophone || state.hasPEBSAnglophone
        const classList = generateClassList(concernedLevels, state.classesPerLevel, state.conventionNommage ?? 'LETTRES')
        const analyzePEBS = async () => {
          if (!pebsDescription.trim()) return
          setPebsLoading(true)
          setPebsError('')
          try {
            // Construire l'historique : si c'est le premier appel, l'initialiser ;
            // sinon garder l'historique déjà accumulé + le nouveau message utilisateur
            const updatedHistory = pebsConversation.length === 0
              ? [{ role: 'user' as const, content: pebsDescription }]
              : [...pebsConversation, { role: 'user' as const, content: pebsDescription }]
            setPebsConversation(updatedHistory)

            const res = await fetchApi('/api/v2/onboarding/analyze-pebs', {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                description: pebsDescription,
                conversationHistory: updatedHistory,
                context: {
                  subSystem: state.subSystem,
                  cycles: state.cycles,
                  levels: concernedLevels,
                  classesPerLevel: state.classesPerLevel,
                  conventionNommage: state.conventionNommage ?? 'LETTRES',
                  hasPEBSFrancophone: state.hasPEBSFrancophone,
                  hasPEBSAnglophone: state.hasPEBSAnglophone,
                },
              }),
            })
            const data = await res.json()
            if (!data.success) throw new Error(data.message || "Erreur d'analyse")
            // Si clarification demandée, ajouter la question de l'assistant à l'historique
            if (data.data.clarificationNeeded && data.data.clarifications?.length) {
              const assistantMsg = `Question de clarification : ${data.data.clarifications.join(' ')}`
              setPebsConversation(prev => [...prev, { role: 'assistant', content: assistantMsg }])
            }
            setPebsAnalysis(data.data)
          } catch (e: unknown) {
            setPebsError(e instanceof Error ? e.message : "Erreur réseau")
          } finally {
            setPebsLoading(false)
          }
        }
        return (
          <>
            <Bubble>{t(hasPEBS && state.subSystem === 'FRANCOPHONE' ? 'phase2.pebs.bubbleFR' : 'phase2.pebs.bubbleEN')}</Bubble>
            {!pebsAnalysis && (
              <>
                <textarea style={{ ...S.input, minHeight: 120, resize: 'vertical' }}
                  value={pebsDescription}
                  onChange={e => setPebsDescription(e.target.value)}
                  placeholder={t('phase2.pebs.placeholder')}
                />
                {pebsError && (
                  <div style={{ fontSize: 13, color: 'var(--red)', background: 'var(--red-light)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 9, padding: '9px 12px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <XCircle size={14} style={{ flexShrink: 0 }} /> {pebsError}
                  </div>
                )}
                <button style={{ ...S.primary, width: '100%', justifyContent: 'center', opacity: pebsLoading || !pebsDescription.trim() ? 0.6 : 1 }}
                  onClick={analyzePEBS} disabled={pebsLoading || !pebsDescription.trim()}>
                  {pebsLoading ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
                      {t('phase2.pebs.analyzing')}
                    </span>
                  ) : t('phase2.pebs.analyze')}
                </button>
              </>
            )}
            {pebsAnalysis && (
              <div style={{ background: 'var(--bg)', borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
                {pebsAnalysis.clarificationNeeded ? (
                  <>
                    <div style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}><HelpCircle size={15} /> {t('phase2.pebs.clarificationNeeded')}</div>
                    {pebsAnalysis.clarifications.map((q, i) => (
                      <div key={i} style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 4, paddingLeft: 8 }}>• {q}</div>
                    ))}
                    <textarea style={{ ...S.input, minHeight: 80, resize: 'vertical', marginTop: 8 }}
                      value={pebsDescription}
                      onChange={e => setPebsDescription(e.target.value)}
                      placeholder={t('phase2.pebs.clarifyPlaceholder')}
                    />
                    <button style={{ ...S.primary, width: '100%', marginTop: 4 }} onClick={() => { setPebsAnalysis(null); analyzePEBS() }}>
                      {t('phase2.pebs.reanalyze')}
                    </button>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{t('phase2.pebs.reformulation')}</div>
                    <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12, background: 'var(--surface)', borderRadius: 8, padding: '10px 12px' }}>
                      {pebsAnalysis.reformulation}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
                      {t('phase2.pebs.classesCount')} {classList.length}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button style={{ ...S.secondary, flex: 1 }} onClick={() => { setPebsAnalysis(null); setPebsDescription(''); setPebsConversation([]) }}>
                        {t('phase2.pebs.reject')}
                      </button>
                      <button style={{ ...S.primary, flex: 1 }} onClick={() => {
                        patch({ pebsOrganisation: pebsAnalysis.pebsOrganisation })
                        goNext()
                      }}>
                        {t('phase2.pebs.approve')}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            {!pebsAnalysis && <Nav canNext={false} />}
          </>
        )
      }

      case 'calYear':
        return (
          <>
            <Bubble>{t('phase2.calendar.title')}</Bubble>
            <div style={S.label}>{t('phase2.calendar.start')}</div>
            <input type="date" style={S.input} value={state.academicYearStart ?? ''} onChange={e => patch({ academicYearStart: e.target.value })} />
            <div style={S.label}>{t('phase2.calendar.end')}</div>
            <input type="date" style={S.input} value={state.academicYearEnd ?? ''} onChange={e => patch({ academicYearEnd: e.target.value })} />
            <Nav canNext={!!state.academicYearStart} />
          </>
        )

      case 'periods':
        return (
          <>
            <Bubble>{t('phase2.periods.title')}</Bubble>
            <button style={S.opt(state.periodsCount === 3)} onClick={() => patch({ periodsCount: 3 })}><span style={{ flex: 1 }}>{t('phase2.periods.trimesters')}</span></button>
            <button style={S.opt(state.periodsCount === 2)} onClick={() => patch({ periodsCount: 2 })}><span style={{ flex: 1 }}>{t('phase2.periods.semesters')}</span></button>
            <Nav />
          </>
        )

      case 'sequences':
        return (
          <>
            <Bubble>{t('phase2.sequences.title', { period: state.periodsCount === 2 ? t('phase2.sequences.semestre') : t('phase2.sequences.trimestre') })}</Bubble>
            {[2, 3].map(n => (
              <button key={n} style={S.opt(state.sequencesPerPeriod === n)} onClick={() => patch({ sequencesPerPeriod: n })}>
                <span style={{ flex: 1 }}>{t('phase2.sequences.count', { n })}</span>
              </button>
            ))}
            <Nav />
          </>
        )

      case 'fees':
        return (
          <>
            <Bubble>{t('phase2.fees.title')}</Bubble>
            {feesOptions.map(o => (
              <button key={o.value} style={S.opt(state.feesTypes.includes(o.value))} onClick={() => toggleIn('feesTypes', o.value)}>
                <span style={{ flex: 1 }}>{o.label}</span>
                {state.feesTypes.includes(o.value) && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
              </button>
            ))}
            <Nav canNext={state.feesTypes.length > 0} />
          </>
        )

      case 'tranches':
        return (
          <>
            <Bubble>{t('phase2.tranches.title')}</Bubble>
            {[{ n: 1, key: 'phase2.tranches.oneTime' }, { n: 2, key: 'phase2.tranches.two' }, { n: 3, key: 'phase2.tranches.three' }].map(o => (
              <button key={o.n} style={S.opt(state.paymentTranches === o.n)} onClick={() => patch({ paymentTranches: o.n })}><span style={{ flex: 1 }}>{t(o.key)}</span></button>
            ))}
            <Nav />
          </>
        )

      case 'services':
        return (
          <>
            <Bubble>{t('phase2.services.title')}</Bubble>
            {([
              ['hasCanteen', 'phase2.services.canteen'],
              ['hasTransport', 'phase2.services.transport'],
              ['hasLibrary', 'phase2.services.library'],
              ['hasBoarding', 'phase2.services.boarding'],
            ] as const).map(([key, tKey]) => (
              <button key={key} style={S.opt(!!state[key])} onClick={() => patch({ [key]: !state[key] } as Partial<OnboardingState>)}>
                <span style={{ flex: 1 }}>{t(tKey)}</span>
                {state[key] && <span style={{ color: 'var(--green)', display: 'inline-flex' }}><Check size={16} strokeWidth={3} /></span>}
              </button>
            ))}
            <Nav />
          </>
        )

      case 'direction':
        return (
          <>
            <Bubble>{t('phase2.direction.title')}</Bubble>
            <div style={S.label}>{t('phase2.direction.proviseur')}</div>
            <input style={S.input} value={state.directionRoles.proviseur ?? ''} onChange={e => patch({ directionRoles: { ...state.directionRoles, proviseur: e.target.value } })} placeholder={t('phase2.direction.placeholder')} />
            <div style={S.label}>{t('phase2.direction.censeur')}</div>
            <input style={S.input} value={state.directionRoles.censeur ?? ''} onChange={e => patch({ directionRoles: { ...state.directionRoles, censeur: e.target.value } })} placeholder={t('phase2.direction.placeholder')} />
            <div style={S.label}>{t('phase2.direction.surveillantGeneral')}</div>
            <input style={S.input} value={state.directionRoles.surveillantGeneral ?? ''} onChange={e => patch({ directionRoles: { ...state.directionRoles, surveillantGeneral: e.target.value } })} placeholder={t('phase2.direction.placeholder')} />
            <div style={S.label}>{t('phase2.direction.intendant')}</div>
            <input style={S.input} value={state.directionRoles.intendant ?? ''} onChange={e => patch({ directionRoles: { ...state.directionRoles, intendant: e.target.value } })} placeholder={t('phase2.direction.placeholder')} />
            <Nav />
          </>
        )

      case 'admissions':
        return (
          <>
            <Bubble>{t('phase2.admissions.title')}</Bubble>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>{t('phase2.admissions.subtitle')}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  checked={state.directAdmissionWithoutExam !== false}
                  onChange={e => patch({ directAdmissionWithoutExam: e.target.checked })}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{t('phase2.admissions.directAdmission')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t('phase2.admissions.directAdmissionDesc')}</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  checked={state.selfServiceEnabled !== false}
                  onChange={e => patch({ selfServiceEnabled: e.target.checked })}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{t('phase2.admissions.selfService')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t('phase2.admissions.selfServiceDesc')}</div>
                </div>
              </label>

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                <input
                  type="checkbox"
                  checked={state.adminGereInscriptions !== false}
                  onChange={e => patch({ adminGereInscriptions: e.target.checked })}
                  style={{ marginTop: 3 }}
                />
                <div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{t('phase2.admissions.adminValidation')}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{t('phase2.admissions.adminValidationDesc')}</div>
                </div>
              </label>
            </div>

            <div style={S.label}>{t('phase2.admissions.capacityBuffer')}</div>
            <select
              style={{ ...S.input, marginBottom: 14 }}
              value={state.capacityBufferPercent ?? 0}
              onChange={e => patch({ capacityBufferPercent: Number(e.target.value) })}
            >
              <option value={0}>0% (Capacité stricte)</option>
              <option value={5}>+5% de surcapacité tolérée</option>
              <option value={10}>+10% de surcapacité tolérée</option>
              <option value={15}>+15% de surcapacité tolérée</option>
            </select>

            <Nav nextLabel={t('phase2.nav.recap')} />
          </>
        )

      case 'recap':
        return <Recap state={state} template={state.template ?? detectedTemplate} onConfirm={() => props.onComplete({ ...state, template: state.template ?? detectedTemplate })} onBack={goBack} />

      default:
        return null
    }
  }

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 6 }}>
          {(['fr', 'en'] as const).map(l => (
            <button key={l} onClick={() => changeLanguage(l)}
              style={{
                padding: '4px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                cursor: 'pointer', fontFamily: 'inherit', border: '1.5px solid',
                background: lang === l ? 'var(--green)' : 'var(--surface)',
                color: lang === l ? 'var(--surface)' : 'var(--text2)',
                borderColor: lang === l ? 'var(--green)' : 'var(--border2)',
              }}>{l === 'fr' ? 'FR' : 'EN'}</button>
          ))}
        </div>
        <div style={{ marginBottom: 18 }}>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,var(--primary),var(--primary-hover))', borderRadius: 3, transition: 'width 0.35s ease' }} />
          </div>
        </div>
        {renderStep()}
      </div>
    </div>
  )
}

// ── Récapitulatif ────────────────────────────────────────────────────────────
function Recap({ state, template, onConfirm, onBack }: { state: OnboardingState; template: string; onConfirm: () => void; onBack: () => void }) {
  const t = useT('onboarding')
  const lv2LabelMap: Record<string, string> = {}
  LV2_LANG_KEYS.forEach(l => { lv2LabelMap[l.value] = t(l.key) })
  const lv2Summary = state.lv2Active && state.lv2Languages.length
    ? state.lv2Languages.map(l => lv2LabelMap[l] ?? l).join(', ')
    : t('phase2.recap.lv2Inactive')
  const hasPerClassOrg = state.lv2Organisation.some(r => r.className)
  const perClassLines = hasPerClassOrg
    ? state.lv2Organisation
        .filter(r => r.className)
        .sort((a, b) => (a.className ?? '').localeCompare(b.className ?? ''))
        .map(r => {
          if (r.organisation === 'UNIFORME' && r.langue) return `${r.className} → ${lv2LabelMap[r.langue] ?? r.langue}`
          if (r.organisation === 'MIXTE' && r.langues?.length) return `${r.className} → ${r.langues.map(l => lv2LabelMap[l] ?? l).join(' / ')}`
          return `${r.className} → ?`
        })
    : []
  const services = [
    state.hasCanteen && t('phase2.services.canteen'),
    state.hasTransport && t('phase2.services.transport'),
    state.hasLibrary && t('phase2.services.library'),
    state.hasBoarding && t('phase2.services.boarding'),
  ].filter(Boolean).join(', ') || t('phase2.recap.servicesNone')
  const roles = [
    state.directionRoles.proviseur && `${t('phase2.recap.proviseur')}: ${state.directionRoles.proviseur}`,
    state.directionRoles.censeur && `${t('phase2.recap.censeur')}: ${state.directionRoles.censeur}`,
  ].filter(Boolean).join(' · ') || t('phase2.recap.directionNone')

  const Block = ({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) => (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 12, padding: '13px 15px', marginBottom: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: 'var(--green)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={13} /> {title}</div>
      <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6 }}>{children}</div>
    </div>
  )

  return (
    <>
      <div style={S.bubble} dangerouslySetInnerHTML={{ __html: t('phase2.recap.bubble', { schoolName: state.schoolName ?? '' }) }} />

      <Block icon={BookOpen} title={t('phase2.recap.structure')}>
        {t('phase2.recap.template')}&nbsp;: <strong>{TEMPLATE_LABELS[template] ?? template}</strong><br />
        {t('phase2.recap.cycles')}&nbsp;: {state.cycles.length ? state.cycles.map(c => {
          const match = CYCLE_KEYS.find(o => o.value === c)
          return match ? t(match.key).split(' (')[0] ?? t(match.key) : c
        }).join(', ') : '—'}<br />
        {state.series.length > 0 && <>{t('phase2.recap.seriesFr')}&nbsp;: {state.series.join(', ')}<br /></>}
        {state.anglophoneStreams.length > 0 && (
          <>{t('phase2.recap.streamsEn')}&nbsp;: {state.anglophoneStreams.map(s => {
            const match = ANGLO_STREAM_KEYS.find(o => o.value === s)
            return match ? t(match.key) : s
          }).join(', ')}
            {state.anglophoneCombinations.length > 0 && ` — ${t('phase2.recap.combinaisons')} ${state.anglophoneCombinations.join(', ')}`}<br /></>
        )}
        {state.technicalFilieres.length > 0 && <>{t('phase2.recap.filieres')}&nbsp;: {state.technicalFilieres.join(', ')}<br /></>}
        {t('phase2.recap.autoClasses')}
      </Block>

      <Block icon={Languages} title={t('phase2.recap.langues')}>
        {t('phase2.recap.lv2')}&nbsp;: {lv2Summary}
        {perClassLines.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {perClassLines.map(line => (
              <div key={line} style={{ fontSize: 13, color: 'var(--text2)', paddingLeft: 8 }}>{line}</div>
            ))}
          </div>
        )}
      </Block>

      {(state.hasPEBSFrancophone || state.hasPEBSAnglophone) && (
        <Block icon={Landmark} title={t('phase2.recap.pebs')}>
          {state.hasPEBSFrancophone && <div>{t('phase2.recap.pebsFR')}</div>}
          {state.hasPEBSAnglophone && <div>{t('phase2.recap.pebsEN')}</div>}
          {state.pebsOrganisation && state.pebsOrganisation.length > 0 ? (
            <div style={{ marginTop: 6 }}>
              {[...state.pebsOrganisation]
                .sort((a, b) => a.className.localeCompare(b.className))
                .map(r => (
                  <div key={r.className} style={{ fontSize: 13, color: 'var(--text2)', paddingLeft: 8 }}>
                    {r.className} → {t(r.statut === 'PEBS_PUR' ? 'phase2.recap.pebsPur' : r.statut === 'MIXTE' ? 'phase2.recap.pebsMixte' : 'phase2.recap.pebsNon')}
                  </div>
                ))}
              {state.pebsOrganisation.some(r => r.statut === 'MIXTE') && (
                <div style={{ fontSize: 12, color: 'var(--amber)', marginTop: 6, fontStyle: 'italic' }}>
                  {t('phase2.recap.pebsMixteNote')}
                </div>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4 }}>{t('phase2.recap.pebsDefault')}</div>
          )}
        </Block>
      )}

      <Block icon={Calendar} title={t('phase2.recap.calendrier')}>
        {t('phase2.recap.debut')}&nbsp;: {state.academicYearStart || '—'}<br />
        {state.periodsCount === 2 ? t('phase2.periods.semesters') : t('phase2.periods.trimesters')} × {state.sequencesPerPeriod} {t('phase2.recap.sequences')}
      </Block>

      <Block icon={Wallet} title={t('phase2.recap.finances')}>
        {t('phase2.recap.fees')}&nbsp;: {state.feesTypes.length ? state.feesTypes.map(f => {
          const match = FEES_KEYS.find(o => o.value === f)
          return match ? t(match.key) : f
        }).join(', ') : '—'}<br />
        {state.paymentTranches} {t('phase2.recap.tranches')} · {t('phase2.recap.services')}&nbsp;: {services}
      </Block>

      <Block icon={Users} title={t('phase2.recap.direction')}>{roles}</Block>

      <Block icon={UserPlus} title={t('phase2.recap.admissions')}>
        {state.directAdmissionWithoutExam ? t('phase2.recap.directAdmissionYes') : t('phase2.recap.directAdmissionNo')}<br />
        {state.adminGereInscriptions ? t('phase2.recap.adminValidationYes') : t('phase2.recap.adminValidationNo')}<br />
        {t('phase2.admissions.capacityBuffer')}&nbsp;: +{state.capacityBufferPercent ?? 0}%
      </Block>

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        <button style={S.secondary} onClick={onBack}>{t('phase2.recap.modify')}</button>
        <button style={{ ...S.primary, flex: 1 }} onClick={onConfirm}>{t('phase2.recap.confirm')}</button>
      </div>
    </>
  )
}
