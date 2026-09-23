'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams } from 'next/navigation'
import PasswordStrengthBar, { getPasswordStrength } from '@/components/PasswordStrengthBar'
import { useT, useChangeLanguage, useLanguage } from '@/lib/i18n'
import {
  Languages, BookOpen, Settings, Wrench, GraduationCap, Landmark, School, Church,
  AlertTriangle, CheckCircle2, Info, Check, Star, BarChart3, CreditCard, Calendar,
  Lock, AlarmClock, PartyPopper, Eye, EyeOff,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { TemplateCatalogEntry } from '@/lib/onboarding/templateCatalogTypes'
import { pickEffectiveTemplateCode, templateDisplayName, suggestTemplateCode } from '@/lib/onboarding/templateSelection'
import { resolveTemplateCandidates } from '@/lib/onboarding/resolveTemplateCandidates'
import type { LevelFamily, OfferFlag, Phase1Profile, SchoolStructure, SecondarySpan } from '@/lib/onboarding/phase1Profile'
import { deriveEducationType } from '@/lib/onboarding/phase1Profile'
import { showPremierCycle, showDeuxiemeCycle, showSeriesFr, showStreamsEn, showTechnique, showTechniqueBlocks, showPrimaire, hasMaternelleData, hasPrimaireData, hasPremierCycleData, hasDeuxiemeCycleData, hasTechniqueData, isPebsFrEligible, isPebsEnEligible } from '@/lib/onboarding/templateGates'
import { buildOnboardingConfig } from '@/lib/onboarding/buildOnboardingConfig'

// ── Types ──────────────────────────────────────────────────────────────────

type LoadState = 'loading' | 'valid' | 'invalid' | 'expired' | 'used'
type Step = 1 | 2 | 3 | 4 | 5

interface InviteData {
  schoolName: string
  email: string
  plan: string
  notes: string | null
}

interface PreviewData {
  classes: { name: string; level: string; section: string }[]
  totalClasses: number
  subjects: string[]
}

interface FormData {
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

// ── Constants ──────────────────────────────────────────────────────────────

const REGIONS = ['Adamaoua','Centre','Est','Extrême-Nord','Littoral','Nord','Nord-Ouest','Ouest','Sud','Sud-Ouest']

const PLAN_COLOR: Record<string, string> = {
  DISCOVERY: 'var(--green)', STANDARD: 'var(--blue)', PREMIUM: '#9333ea',
}

const SUBSYSTEM_KEYS = [
  { value: 'FRANCOPHONE', key: 'phase1.step1.subsystem.options.FRANCOPHONE.label', icon: Languages },
  { value: 'ANGLOPHONE',  key: 'phase1.step1.subsystem.options.ANGLOPHONE.label',  icon: Languages },
  { value: 'BILINGUAL',   key: 'phase1.step1.subsystem.options.BILINGUAL.label',   icon: Languages },
]
const OWNERSHIP_KEYS = [
  { value: 'PUBLIC',          key: 'phase1.step1.ownership.options.PUBLIC.label',          icon: Landmark },
  { value: 'PRIVATE_SECULAR', key: 'phase1.step1.ownership.options.PRIVATE_SECULAR.label', icon: School },
  { value: 'PRIVATE_FAITH',   key: 'phase1.step1.ownership.options.PRIVATE_FAITH.label',   icon: Church },
]

const NIVEAUX_1ER_CYCLE_FR = ['6e','5e','4e','3e']
const NIVEAUX_1ER_CYCLE_CAP = ['CAP1','CAP2','CAP3','CAP4']
const NIVEAUX_1ER_CYCLE_EN = ['Form 1','Form 2','Form 3','Form 4','Form 5']
const NIVEAUX_1ER_CYCLE_EN_LOWER = ['Form 1','Form 2','Form 3']
const NIVEAUX_2E_CYCLE_FR = ['2nde','1ère','Tle']
const NIVEAUX_2E_CYCLE_EN = ['Lower Sixth','Upper Sixth']

const FIRST_CYCLE_LEVELS = [...NIVEAUX_1ER_CYCLE_FR, ...NIVEAUX_1ER_CYCLE_CAP, ...NIVEAUX_1ER_CYCLE_EN]
const SECOND_CYCLE_LEVELS = [...NIVEAUX_2E_CYCLE_FR, ...NIVEAUX_2E_CYCLE_EN]

const FILIERES_LITT = [
  'A4 — Langues Vivantes',
  'A1 — Littéraire LV1 renforcée',
  'A2 — Littéraire LV2 renforcée',
  'A3 — Littéraire LV3 renforcée',
  'A5 — Philosophie renforcée',
  'SH — Sciences Humaines',
  'AC — Arts et Cinématographiques (rare)',
]
const FILIERES_SCIENT = ['C — Mathématiques-Physique','D — Mathématiques-SVT','TI — Technologies de l\'Information','E — (rare)']
const FILIERES_TECH = ['F · G · H (technique)']
const FILIERES_EN = ['Arts (A1 · A2 · A3 · A4)','Sciences (S1 · S2 · S3 · S4)']

const FILIERES_EN_ARTS = ['A1 — Literature','A2 — History','A3 — Geography','A4 — Languages']
const FILIERES_EN_SCIENCES = ['S1 — Maths','S2 — Physics','S3 — Biology','S4 — Chemistry']

const NIVEAUX_EN_FULL = ['Form 1','Form 2','Form 3','Form 4','Form 5','Lower Sixth','Upper Sixth']

const FILIERES_TECHNIQUES_OFF = ['F1','F2','F3','G1','G2','G3','INFOR','HOTEL','COUTURE','AGRIC']
const FILIERES_TECHNIQUES_TER = ['MAEL','TMI','ECS','ESF','IH']

const NIVEAUX_PRIMAIRE_FR = ['SIL','CP','CE1','CE2','CM1','CM2']
const NIVEAUX_PRIMAIRE_EN = ['Class 1','Class 2','Class 3','Class 4','Class 5','Class 6']
const NIVEAUX_MATERNELLE = ['Petite section','Moyenne section','Grande section']

const LV2_OPTIONS = ['Espagnol','Allemand','Chinois','Arabe','Latin','Italien']

const CONVENTION_KEYS = [
  { value: 'LETTRES',  key: 'phase1.step3.firstCycle.naming.LETTRES.label',  descKey: 'phase1.step3.firstCycle.naming.LETTRES.desc' },
  { value: 'CHIFFRES', key: 'phase1.step3.firstCycle.naming.CHIFFRES.label', descKey: 'phase1.step3.firstCycle.naming.CHIFFRES.desc' },
  { value: 'MIXTE',    key: 'phase1.step3.firstCycle.naming.MIXTE.label',    descKey: 'phase1.step3.firstCycle.naming.MIXTE.desc' },
]

const SAR_METIERS_OPTIONS = ['Maçonnerie','Menuiserie','Couture','Cuisine','Agriculture','Mécanique']
const CFM_FILIERES_OPTIONS = ['Agro-alimentaire','Artisanat','BTP','Numérique']
const CETIF_FILIERES_OPTIONS = ['ESF','Couture','Hôtellerie','Cuisine']

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
const MAX_STEPPER = 6

// ── Helpers ────────────────────────────────────────────────────────────────

function toSlug(v: string) {
  return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function toggleInArray(arr: string[], item: string): string[] {
  return arr.includes(item) ? arr.filter(x => x !== item) : [...arr, item]
}

function previewClassNames(level: string, count: number, convention: string): string[] {
  if (convention === 'LETTRES') {
    return Array.from({ length: Math.min(count, 26) }, (_, i) => `${level} ${LETTERS[i]}`)
  }
  if (convention === 'CHIFFRES') {
    return Array.from({ length: Math.min(count, 99) }, (_, i) => `${level} ${i + 1}`)
  }
  if (convention === 'MIXTE') {
    return Array.from({ length: Math.min(count, 26) }, (_, i) => `${level} ${LETTERS[i]}1`)
  }
  return []
}

// ── Sub-components ─────────────────────────────────────────────────────────

const INPUT: React.CSSProperties = {
  width: '100%', padding: '11px 14px', background: 'var(--surface)',
  border: '1.5px solid var(--border2)', borderRadius: 10, color: 'var(--text)',
  fontSize: 17, fontFamily: 'inherit', fontWeight: 600, outline: 'none',
  boxSizing: 'border-box', transition: 'all 0.2s',
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 6, display: 'block', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
        {label}{required && <span style={{ color: 'var(--red)', marginLeft: 3 }}>*</span>}
      </label>
      {children}
    </div>
  )
}

function Alert({ msg, type }: { msg: string; type: 'error' | 'success' | 'info' }) {
  const styles = {
    error:   { bg: 'var(--red-light)', border: 'rgba(220,38,38,0.25)',  color: 'var(--red)', icon: AlertTriangle },
    success: { bg: 'var(--green-light)', border: 'rgba(142,42,58,0.25)',  color: 'var(--green)', icon: CheckCircle2 },
    info:    { bg: 'var(--blue-light)', border: 'rgba(37,99,235,0.25)',  color: 'var(--blue)', icon: Info },
  }[type]
  const Icon = styles.icon
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', background: styles.bg, border: `1.5px solid ${styles.border}`, borderRadius: 10, marginBottom: 14, fontSize: 14, fontWeight: 700, color: styles.color }}>
      <Icon size={16} strokeWidth={2} style={{ flexShrink: 0 }} /><span>{msg}</span>
    </div>
  )
}

function RadioCards({ options, value, onChange }: {
  options: { value: string; label: string; icon: LucideIcon }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${options.length <= 3 ? options.length : 2}, 1fr)`, gap: 8 }}>
      {options.map(o => {
        const active = value === o.value
        return (
          <button key={o.value} type="button" onClick={() => onChange(o.value)}
            style={{
              padding: '10px 8px', border: `2px solid ${active ? 'var(--green)' : 'var(--border2)'}`,
              borderRadius: 10, background: active ? 'rgba(5,150,105,0.07)' : 'white',
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}>
            <span style={{ display: 'flex', color: active ? 'var(--green2)' : 'var(--text2)' }}><o.icon size={22} strokeWidth={2} /></span>
            <span style={{ fontSize: 12, fontWeight: 700, color: active ? 'var(--green2)' : 'var(--text2)', textAlign: 'center', lineHeight: 1.2 }}>{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function SubmitBtn({ loading, disabled, onClick, children, loadingText }: { loading?: boolean; disabled?: boolean; onClick?: () => void; children: React.ReactNode; loadingText?: string }) {
  return (
    <button type="button" onClick={onClick} disabled={loading || disabled}
      style={{
        width: '100%', padding: '14px', background: loading || disabled ? '#a8d5c2' : 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
        color: 'white', fontSize: 18, fontWeight: 800, border: 'none', borderRadius: 10,
        cursor: loading || disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
        boxShadow: loading || disabled ? 'none' : '0 4px 16px rgba(142,42,58,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8, transition: 'all 0.2s',
      }}>
      {loading
        ? <><div style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} /> {loadingText || 'Traitement en cours…'}</>
        : children}
    </button>
  )
}

function CheckboxGroup({ options, values, onChange, note }: {
  options: { value: string; label: string }[]
  values: string[]
  onChange: (v: string[]) => void
  note?: string
}) {
  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {options.map(o => {
          const checked = values.includes(o.value)
          return (
            <label key={o.value} onClick={() => onChange(checked ? values.filter(v => v !== o.value) : [...values, o.value])}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
                border: `2px solid ${checked ? 'var(--green)' : 'var(--border2)'}`,
                borderRadius: 8, background: checked ? 'rgba(5,150,105,0.07)' : 'white',
                cursor: 'pointer', fontSize: 14, fontWeight: 700, color: checked ? 'var(--green2)' : 'var(--text2)',
                transition: 'all 0.15s', userSelect: 'none',
              }}>
              <span style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${checked ? 'var(--green)' : 'var(--border2)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: checked ? 'var(--green)' : 'transparent', flexShrink: 0 }}>
                {checked && <Check size={12} strokeWidth={3} style={{ color: 'white' }} />}
              </span>
              {o.label}
            </label>
          )
        })}
      </div>
      {note && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, fontWeight: 600, lineHeight: 1.5 }}>{note}</div>}
    </div>
  )
}

function StepperBtns({ value, onChange, max = MAX_STEPPER }: { value: number; onChange: (v: number) => void; max?: number }) {
  return (
    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
      {Array.from({ length: max }, (_, i) => i + 1).map(n => (
        <button key={n} type="button" onClick={() => onChange(n)}
          style={{
            width: 32, height: 32, borderRadius: 8, border: `2px solid ${value === n ? 'var(--green)' : 'var(--border2)'}`,
            background: value === n ? 'var(--green)' : 'white', color: value === n ? 'white' : 'var(--text2)',
            fontSize: 14, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 0.12s',
          }}>{n}</button>
      ))}
    </div>
  )
}

function ClassPreview({ levels, convention, emptyLabel }: { levels: { level: string; count: number }[]; convention: string; emptyLabel?: string }) {
  const lines = levels
    .filter(l => l.count > 0)
    .map(l => `${l.level} : ${previewClassNames(l.level, l.count, convention).join(' · ')}`)

  if (lines.length === 0) {
    return <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>{emptyLabel || 'Aucune classe configurée'}</div>
  }

  return (
    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, fontWeight: 600 }}>
      {lines.map((line, i) => <div key={i}>{line}</div>)}
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const params = useParams()
  const token = params?.token as string

  const [loadState, setLoadState]   = useState<LoadState>('loading')
  const [inviteData, setInviteData] = useState<InviteData | null>(null)
  const [errorMsg, setErrorMsg]     = useState('')
  const [step, setStep]             = useState<Step>(1)
  const [done, setDone]             = useState(false)
  const [createdStats, setCreatedStats] = useState<{ classCount?: number; subjectCount?: number; academicYear?: string } | null>(null)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [submitError, setSubmitError]     = useState('')
  const [stepError, setStepError]         = useState('')
  const [showPwd, setShowPwd]             = useState(false)
  const [showConfirm, setShowConfirm]     = useState(false)
  const [previewData, setPreviewData]     = useState<PreviewData | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [customLv2, setCustomLv2]         = useState('')
  const [customA4, setCustomA4]           = useState('')
  const [customFiliere, setCustomFiliere] = useState('')
  const [customTech, setCustomTech]       = useState('')
  const [sousTypeTechnique, setSousTypeTechnique] = useState<'IND'|'STT'|'MIXTE'|''>('')
  const [cetifMode, setCetifMode]               = useState(false)
  const [sarMetiers, setSarMetiers]             = useState<string[]>([])
  const [cfmFilieres, setCfmFilieres]           = useState<string[]>([])
  const [maternelleSections, setMaternelleSections] = useState<string[]>(['Petite section','Moyenne section','Grande section'])
  const [nurseryLevels, setNurseryLevels]       = useState<string[]>(['PreNursery','Nursery 1','Nursery 2'])
  const [customSarMetier, setCustomSarMetier]   = useState('')
  const [customCfmFiliere, setCustomCfmFiliere] = useState('')
  const [enGradingSystem, setEnGradingSystem]   = useState<'OVER_20'|'OVER_100'|''>('')
  const [bulletinFrequency, setBulletinFrequency] = useState<'MONTHLY'|'TRIMESTRIAL'>('MONTHLY')
  const [evalSystemPrimaire, setEvalSystemPrimaire] = useState<'APC_300'|'NOTES_20'|''>('')
  const [appelFrequency, setAppelFrequency]     = useState<'TWICE'|'ONCE'|''>('')
  const [hasPEBSFrancophone, setHasPEBSFrancophone] = useState(false)
  const [hasPEBSAnglophone, setHasPEBSAnglophone]   = useState(false)
  const [enStreamStartLevel, setEnStreamStartLevel] = useState<'FORM4'|'FORM5'|'SIXTH'|''>('')
  const [bilingualEnLevels, setBilingualEnLevels]   = useState<string[]>([])
  const [bilingualEnFilieres, setBilingualEnFilieres] = useState<string[]>([])
  const [templateCatalog, setTemplateCatalog] = useState<TemplateCatalogEntry[]>([])
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<string | null>(null)
  const [structure, setStructure] = useState<SchoolStructure | null>(null)
  const [levelFamily, setLevelFamily] = useState<LevelFamily | null>(null)
  const [offers, setOffers] = useState<OfferFlag[]>([])
  const [secondarySpan, setSecondarySpan] = useState<SecondarySpan>(null)

  const t = useT('onboarding')
  const { lang: currentLang } = useLanguage()
  const changeLanguage = useChangeLanguage()

  const [form, setForm] = useState<FormData>({
    nom: '', subdomain: '', subsystem: 'FRANCOPHONE', educationType: 'GENERAL',
    ownership: 'PRIVATE_SECULAR', admissionType: 'MIXTE', ville: '', region: '', telephone: '', adresse: '',
    logoBase64: '',
    adminPrenom: '', adminNom: '', adminEmail: '', password: '', confirmPassword: '',
    niveaux1erCycle: [],
    classesParNiveau: {},
    conventionNommage: 'LETTRES',
    lv2Debut: 'NON_APPLICABLE',
    lv2Disponibles: [],
    niveaux2eCycle: [],
    filieres: [],
    a4Languages: [],
    classesParFiliere: '1',
    filieresTechniques: [],
    niveauxPrimaire: [],
    classesParNiveauPrimaire: {},
  })

  // Charger catalogue depuis backend (source unique)
  useEffect(() => {
    fetch('/api/v2/onboarding/template-catalog').then(r => r.json()).then(data => {
      if (data?.success && Array.isArray(data.data?.templates)) {
        setTemplateCatalog(data.data.templates)
      }
    }).catch(() => {})
  }, [])

  const profile = useMemo<Phase1Profile>(() => ({
    subsystem: form.subsystem === 'FRANCOPHONE' || form.subsystem === 'ANGLOPHONE' || form.subsystem === 'BILINGUAL' ? form.subsystem : null,
    structure,
    levelFamily,
    offers,
    secondarySpan,
    ownership: form.ownership === 'PUBLIC' || form.ownership === 'PRIVATE_SECULAR' || form.ownership === 'PRIVATE_FAITH' ? form.ownership : null,
    selectedTemplateCode,
  }), [form.subsystem, form.ownership, structure, levelFamily, offers, secondarySpan, selectedTemplateCode])

  const suggestedCode = useMemo(() => suggestTemplateCode(profile, templateCatalog), [profile, templateCatalog])

  const effectiveCode = useMemo(() => pickEffectiveTemplateCode(selectedTemplateCode, suggestedCode), [selectedTemplateCode, suggestedCode])
  const catalogTemplate = useMemo(() => {
    if (!effectiveCode) return null
    return templateCatalog.find(t => t.code === effectiveCode) ?? null
  }, [effectiveCode, templateCatalog])
  const template = useMemo(() => {
    return catalogTemplate
  }, [catalogTemplate])

  const filteredTemplates = useMemo(() => resolveTemplateCandidates(templateCatalog, profile), [templateCatalog, profile])

  useEffect(() => {
    setForm((current) => ({ ...current, educationType: deriveEducationType(offers) ?? (structure === 'COMPLEX' ? 'MIXED' : '') }))
  }, [offers, structure])

  useEffect(() => {
    if (selectedTemplateCode !== null && !filteredTemplates.some((candidate) => candidate.code === selectedTemplateCode)) {
      setSelectedTemplateCode(null)
    }
    if (levelFamily !== 'SECONDARY' && secondarySpan !== null) setSecondarySpan(null)
  }, [filteredTemplates, selectedTemplateCode, levelFamily, secondarySpan])

  function setWithTemplateReset(k: 'subsystem' | 'ownership') {
    return (v: string) => {
      setSelectedTemplateCode(null)
      setForm(f => ({ ...f, [k]: v }))
    }
  }

  const set = (k: keyof FormData) => (v: string) => setForm(f => ({ ...f, [k]: v }))
  const slRef = useRef(false)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const errorRef = useRef<HTMLDivElement>(null)
  const previewTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const subsystemOptions = useMemo(() => SUBSYSTEM_KEYS.map(k => ({ ...k, label: t(k.key) })), [t])
  const ownershipOptions = useMemo(() => OWNERSHIP_KEYS.map(k => ({ ...k, label: t(k.key) })), [t])
  const conventionOptions = useMemo(() => CONVENTION_KEYS.map(k => ({ ...k, label: t(k.key), desc: t(k.descKey) })), [t])

  function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 1.5 * 1024 * 1024) { setStepError(t('phase1.step1.logo.errorSize')); return }
    const reader = new FileReader()
    reader.onload = () => set('logoBase64')(reader.result as string)
    reader.readAsDataURL(file)
  }

  // Auto-generate subdomain from school name
  useEffect(() => {
    if (!slRef.current && form.nom) {
      setForm(f => ({ ...f, subdomain: toSlug(f.nom) }))
    }
  }, [form.nom])

  // Validate token on mount
  useEffect(() => {
    if (!token) {
      const t = setTimeout(() => {
        setLoadState('invalid')
        setErrorMsg('Lien d\'invitation invalide ou incomplet.')
      }, 1000)
      return () => clearTimeout(t)
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12000)

    fetch(`/api/v2/onboarding/invite/${token}`, {
      signal: controller.signal,
      headers: { 'ngrok-skip-browser-warning': '1' },
    })
      .then(r => {
        if (!r.ok && r.status !== 404 && r.status !== 410) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(data => {
        if (data.success) {
          setInviteData(data.data)
          setForm(f => ({ ...f, nom: data.data.schoolName, adminEmail: data.data.email }))
          setLoadState('valid')
        } else {
          const msg: string = data.message ?? 'Invitation invalide.'
          if (msg.includes('expiré')) setLoadState('expired')
          else if (msg.includes('utilisée')) setLoadState('used')
          else setLoadState('invalid')
          setErrorMsg(msg)
        }
      })
      .catch((err) => {
        if (err?.name === 'AbortError') {
          setLoadState('invalid')
          setErrorMsg('La vérification a pris trop de temps. Vérifiez votre connexion et réessayez.')
        } else {
          setLoadState('invalid')
          setErrorMsg('Impossible de vérifier l\'invitation. Vérifiez votre connexion.')
        }
      })
      .finally(() => clearTimeout(timeout))
  }, [token])

  // Réinitialiser maternelleSections/nurseryLevels si le template ne correspond pas
  // (COMPLEXE_SCOLAIRE garde maternelleSections — un complexe inclut typiquement une maternelle)
  useEffect(() => {
    if (template?.code !== 'MATERNELLE_FR' && !template?.isComplexe) setMaternelleSections([]);
    if (template?.code !== 'NURSERY_EN') setNurseryLevels([]);
  }, [template?.code, template?.isComplexe])

  // Reset des états hors scope quand le template change (gating catalogue)
  useEffect(() => {
    if (!template) return
    if (!showPremierCycle(template)) {
      setForm(f => (f.niveaux1erCycle.length === 0 && Object.keys(f.classesParNiveau).length === 0 ? f : { ...f, niveaux1erCycle: [], classesParNiveau: {} }))
    }
    if (!showDeuxiemeCycle(template)) {
      setForm(f => (f.niveaux2eCycle.length === 0 && f.filieres.length === 0 ? f : { ...f, niveaux2eCycle: [], filieres: [], a4Languages: [] }))
      if (enStreamStartLevel) setEnStreamStartLevel('')
      if (bilingualEnLevels.length) setBilingualEnLevels([])
      if (bilingualEnFilieres.length) setBilingualEnFilieres([])
      if (enGradingSystem) setEnGradingSystem('')
    }
    if (!isPebsFrEligible(template.code)) {
      if (hasPEBSFrancophone) setHasPEBSFrancophone(false)
    }
    if (!isPebsEnEligible(template.code)) {
      if (hasPEBSAnglophone) setHasPEBSAnglophone(false)
    }
    if (!showTechniqueBlocks(template, offers)) {
      setForm(f => (f.filieresTechniques.length === 0 ? f : { ...f, filieresTechniques: [] }))
      if (sarMetiers.length) setSarMetiers([])
      if (cfmFilieres.length) setCfmFilieres([])
      if (sousTypeTechnique) setSousTypeTechnique('')
      if (cetifMode) setCetifMode(false)
    }
    if (!showPrimaire(template)) {
      setForm(f => (f.niveauxPrimaire.length === 0 && Object.keys(f.classesParNiveauPrimaire).length === 0 ? f : { ...f, niveauxPrimaire: [], classesParNiveauPrimaire: {} }))
    }
  }, [template?.code])

  // Auto-ajouter/retirer ABI des filières quand PEBS Francophone change
  useEffect(() => {
    setForm(f => {
      const abiEntry = 'ABI — A Bilingue (Intensive English)';
      const hasABI = f.filieres.includes(abiEntry);
      const hasSecondCycle = f.niveaux2eCycle.length > 0;
      if (hasPEBSFrancophone && hasSecondCycle && !hasABI) {
        return { ...f, filieres: [...f.filieres, abiEntry] };
      }
      if ((!hasPEBSFrancophone || !hasSecondCycle) && hasABI) {
        return { ...f, filieres: f.filieres.filter(x => x !== abiEntry) };
      }
      return f;
    });
  }, [hasPEBSFrancophone, form.niveaux2eCycle])

  // Debounced preview fetch when configuration changes
  useEffect(() => {
    if (step !== 3) return
    clearTimeout(previewTimerRef.current)
    if (
      form.niveaux1erCycle.length === 0 && form.niveaux2eCycle.length === 0 &&
      form.niveauxPrimaire.length === 0
    ) {
      setPreviewData(null)
      return
    }
    previewTimerRef.current = setTimeout(() => {
      setPreviewLoading(true)
      const controller = new AbortController()
      fetch('/api/v2/onboarding/preview-structure', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
        body: JSON.stringify({
          templateCode: template?.code,
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
        .then(r => r.json())
        .then(data => {
          if (data.success) setPreviewData(data.data)
        })
        .catch(() => {})
        .finally(() => setPreviewLoading(false))
    }, 600)
    return () => clearTimeout(previewTimerRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    step, form.niveaux1erCycle, form.classesParNiveau, form.conventionNommage,
    form.niveaux2eCycle, form.filieres, form.a4Languages, form.classesParFiliere,
    form.lv2Disponibles, form.niveauxPrimaire, form.classesParNiveauPrimaire,
    template?.code,
  ])

  // Validate step 1
  function validateStep1(): string {
    if (!form.nom.trim())       return 'Le nom de l\'établissement est requis.'
    if (!form.subdomain.trim()) return 'Le sous-domaine est requis.'
    if (!/^[a-z0-9-]+$/.test(form.subdomain)) return 'Le sous-domaine ne peut contenir que des lettres minuscules, chiffres et tirets.'
    if (form.subdomain.length < 3) return 'Le sous-domaine doit faire au moins 3 caractères.'
    if (!profile.subsystem) return t('phase1.step1.validation.subsystem')
    if (!profile.structure) return t('phase1.step1.validation.structure')
    if (profile.structure === 'MONO' && !profile.levelFamily) return t('phase1.step1.validation.levelFamily')
    if (profile.offers.length === 0) return t('phase1.step1.validation.offers')
    if (profile.levelFamily === 'SECONDARY' && profile.offers.length > 0 && profile.secondarySpan === null) return t('phase1.step1.validation.secondarySpan')
    if (!profile.ownership) return t('phase1.step1.validation.ownership')
    if (!effectiveCode || !templateCatalog.some((candidate) => candidate.code === effectiveCode)) return t('phase1.step1.validation.template')
    return ''
  }

  // Validate step 2
  function validateStep2(): string {
    if (!form.adminPrenom.trim()) return 'Le prénom est requis.'
    if (!form.adminNom.trim())    return 'Le nom de famille est requis.'
    if (!form.adminEmail.trim() || !form.adminEmail.includes('@')) return 'Adresse email invalide.'
    if (getPasswordStrength(form.password) < 5) return 'Le mot de passe ne respecte pas toutes les règles de sécurité (12 car., majuscule, minuscule, chiffre, caractère spécial).'
    if (form.password !== form.confirmPassword) return 'Les mots de passe ne correspondent pas.'
    return ''
  }

  // Validate step 3 — gating synchronisé au catalogue
  function validateStep3(): string {
    if (!template) return 'Impossible de détecter le type d\'établissement.'

    if (template.isComplexe) {
      const hasPrimaireCfg = form.niveauxPrimaire.length > 0 || maternelleSections.length > 0
      const has1erCfg = form.niveaux1erCycle.length > 0
      const has2eCfg = form.niveaux2eCycle.length > 0
      if (!hasPrimaireCfg && !has1erCfg && !has2eCfg) return 'Configurez au moins un cycle (maternelle/primaire, 1er cycle ou 2nd cycle).'
      if (has1erCfg && Object.keys(form.classesParNiveau).length < form.niveaux1erCycle.length) return 'Veuillez indiquer le nombre de classes pour chaque niveau du 1er cycle.'
      if (has2eCfg && form.filieres.length === 0 && !bilingualEnLevels.length && !bilingualEnFilieres.length) return 'Veuillez sélectionner au moins une filière ou configurer le volet anglophone.'
      if (form.niveauxPrimaire.length > 0 && Object.keys(form.classesParNiveauPrimaire).length < form.niveauxPrimaire.length) return 'Veuillez indiquer le nombre de classes pour chaque niveau primaire.'
      if (offers.includes('TECHNICAL') && form.filieresTechniques.length === 0) return t('phase1.step1.validation.technicalOffers')
      if (offers.includes('PROFESSIONAL') && sarMetiers.length === 0 && cfmFilieres.length === 0) return t('phase1.step1.validation.professionalOffers')
      return ''
    }

    if (showPremierCycle(template) && form.niveaux1erCycle.length === 0) return 'Veuillez sélectionner au moins un niveau du 1er cycle.'
    if (showPremierCycle(template) && Object.keys(form.classesParNiveau).length < form.niveaux1erCycle.length) return 'Veuillez indiquer le nombre de classes pour chaque niveau.'
    if (showDeuxiemeCycle(template) && form.niveaux2eCycle.length === 0) return 'Veuillez sélectionner au moins un niveau du 2e cycle.'
    if (showSeriesFr(template) && form.filieres.length === 0) return 'Veuillez sélectionner au moins une filière.'
    if (showStreamsEn(template)) {
      if (template.code !== 'GSS_EN' && !enStreamStartLevel) return 'Veuillez sélectionner le niveau de départ des streams.'
      if (!enGradingSystem) return 'Veuillez sélectionner un système de notes.'
    }
    return ''
  }

  function goNext() {
    setStepError('')
    if (step === 1) {
      const err = validateStep1()
      if (err) { setStepError(err); return }
      setStep(2)
    } else if (step === 2) {
      const err = validateStep2()
      if (err) { setStepError(err); return }
      setStep(3)
    } else if (step === 3) {
      const err = validateStep3()
      if (err) { setStepError(err); return }
      setStep(4)
    }
  }

  async function handleSubmit() {
    setSubmitError('')
    setSubmitLoading(true)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    try {
      const url = `/api/v2/onboarding/invite/${token}/complete`
      const res = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'ngrok-skip-browser-warning': '1',
        },
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
                maternelleSections,
                nurseryLevels,
                filieresTechniques: form.filieresTechniques,
                sousTypeTechnique,
                cetifMode,
                sarMetiers,
                cfmFilieres,
                enGradingSystem,
                enStreamStartLevel,
                bilingualEnLevels,
                bilingualEnFilieres,
                hasPEBSFrancophone,
                hasPEBSAnglophone,
                bulletinFrequency,
                evalSystemPrimaire,
                appelFrequency,
              })
            : undefined,
        }),
      })
      clearTimeout(timeout)
      const text = await res.text()
      let data: unknown
      try { data = JSON.parse(text) } catch { throw new Error(`Réponse non-JSON (HTTP ${res.status}): ${text.slice(0, 100)}`) }
      if (typeof data !== 'object' || data === null || !('success' in data)) {
        throw new Error('Réponse invalide du serveur.')
      }
      const responseMessage = 'message' in data && typeof data.message === 'string' ? data.message : 'Erreur lors de la soumission.'
      if (data.success !== true) throw new Error(responseMessage)
      if ('data' in data && typeof data.data === 'object' && data.data !== null) {
        const d = data.data as { classCount?: number; subjectCount?: number; academicYear?: string }
        setCreatedStats({ classCount: d.classCount, subjectCount: d.subjectCount, academicYear: d.academicYear })
      }
      setDone(true)
    } catch (e: unknown) {
      clearTimeout(timeout)
      const msg = e instanceof DOMException && e.name === 'AbortError'
        ? 'La requête a pris trop de temps (>30s). Vérifiez votre connexion et réessayez.'
        : (e instanceof Error ? e.message : 'Erreur réseau. Vérifiez votre connexion et réessayez.')
      setSubmitError(msg)
      setTimeout(() => errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50)
    } finally {
      setSubmitLoading(false)
    }
  }

  function setNiveauCount(niveau: string, count: number) {
    setForm(f => ({ ...f, classesParNiveau: { ...f.classesParNiveau, [niveau]: count } }))
  }

  function setNiveauPrimaireCount(niveau: string, count: number) {
    setForm(f => ({ ...f, classesParNiveauPrimaire: { ...f.classesParNiveauPrimaire, [niveau]: count } }))
  }

  // ── Left panel (constant) ──────────────────────────────────────────────

  const LeftPanel = (
    <div style={{ width: '42vw', minWidth: 0, background: 'var(--sidebar)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', flexShrink: 0 }} className="edu-left-panel">
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 6, zIndex: 2, background: 'repeating-linear-gradient(90deg,var(--amber) 0,var(--amber) 16px,var(--green) 16px,var(--green) 32px,var(--red) 32px,var(--red) 48px,#60a5fa 48px,#60a5fa 64px,#d4a843 64px,#d4a843 80px)' }} />
      <div style={{ position: 'absolute', bottom: -100, right: -100, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(34,197,94,0.06) 0%,transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ padding: '36px 32px', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative', zIndex: 1 }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 44, animation: 'edu-fadeDown 0.6s ease both' }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg,var(--amber),var(--green))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 16px rgba(34,197,94,0.3)', flexShrink: 0 }}><GraduationCap size={28} strokeWidth={2} /></div>
          <div>
            <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'white' }}>ZekoulABia</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>{t('phase1.leftPanel.brandTagline')}</div>
          </div>
          {/* Bascule de langue — FR par défaut, un anglophone passe en EN ici (mémorisé) */}
          <div role="group" aria-label="Language / Langue" style={{ marginLeft: 'auto', display: 'flex', gap: 3, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 10, padding: 3, flexShrink: 0 }}>
            {(['fr', 'en'] as const).map((l) => {
              const active = currentLang === l
              return (
                <button key={l} type="button" onClick={() => { if (!active) changeLanguage(l) }} aria-pressed={active}
                  style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: active ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, letterSpacing: '0.3px', background: active ? '#4ade80' : 'transparent', color: active ? 'var(--sidebar)' : 'rgba(255,255,255,0.7)', transition: 'background 0.15s, color 0.15s' }}>
                  {l === 'fr' ? 'FR' : 'EN'}
                </button>
              )
            })}
          </div>
        </div>

        {/* Heading */}
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 38, fontWeight: 700, lineHeight: 1.15, color: 'white', marginBottom: 12, animation: 'edu-fadeDown 0.6s 0.1s ease both' }}>
          {step <= 2 ? <>{t('phase1.leftPanel.welcomeTitle')}<br /><span style={{ color: '#4ade80' }}>ZekoulABia</span></>
            : step === 3 ? <>{t('phase1.leftPanel.configTitle')}<br /><span style={{ color: '#4ade80' }}>{t('phase1.leftPanel.structureSubtitle')}</span></>
            : step === 4 ? <>{t('phase1.leftPanel.finalCheck')}<br /><span style={{ color: '#4ade80' }}>{t('phase1.leftPanel.finale')}</span></>
            : <>{t('phase1.leftPanel.submitted')}<br /><span style={{ color: '#4ade80' }}>{t('phase1.leftPanel.submittedSuffix')}</span></>}
        </div>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7, fontWeight: 500, marginBottom: 36, animation: 'edu-fadeDown 0.6s 0.2s ease both' }}>
          {step === 1 ? t('phase1.leftPanel.descStep1')
            : step === 2 ? t('phase1.leftPanel.descStep2')
            : step === 3 ? t('phase1.leftPanel.descStep3')
            : step === 4 ? t('phase1.leftPanel.descStep4')
            : t('phase1.leftPanel.descSubmitted')}
        </p>

        {/* Plan badge */}
        {inviteData && (
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, marginBottom: 28, animation: 'edu-fadeDown 0.6s 0.25s ease both', alignSelf: 'flex-start' }}>
            <Star size={18} strokeWidth={2} style={{ color: PLAN_COLOR[inviteData.plan] ?? 'var(--green)' }} />
            <span style={{ fontSize: 14, fontWeight: 800, color: PLAN_COLOR[inviteData.plan] ?? 'var(--green)' }}>{t('phase1.step1.planBadge')} {t('phase1.planLabels.' + inviteData.plan) ?? inviteData.plan}</span>
          </div>
        )}

        {/* Features */}
        {step <= 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, animation: 'edu-fadeDown 0.6s 0.3s ease both' }}>
            {[
              { bg: 'rgba(34,197,94,0.1)',   icon: School,     title: t('phase1.leftPanel.features.multiLevel.title'),      desc: t('phase1.leftPanel.features.multiLevel.desc') },
              { bg: 'rgba(96,165,250,0.1)',   icon: BarChart3,  title: t('phase1.leftPanel.features.grades.title'),          desc: t('phase1.leftPanel.features.grades.desc') },
              { bg: 'rgba(245,158,11,0.1)',   icon: CreditCard, title: t('phase1.leftPanel.features.finance.title'),         desc: t('phase1.leftPanel.features.finance.desc') },
              { bg: 'rgba(212,168,67,0.1)',   icon: Calendar,   title: t('phase1.leftPanel.features.timetable.title'),        desc: t('phase1.leftPanel.features.timetable.desc') },
            ].map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}><f.icon size={20} strokeWidth={2} /></div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                  <strong style={{ color: 'white', fontWeight: 700 }}>{f.title}</strong> — {f.desc}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'auto', paddingTop: 16, fontSize: 13, color: 'rgba(255,255,255,0.2)', fontWeight: 500 }}>
          {t('phase1.leftPanel.copyright')}
        </div>
      </div>
    </div>
  )

  // ── Stepper ────────────────────────────────────────────────────────────

  const STEPPER_LABELS: { n: Step; key: string }[] = [
    { n: 1, key: 'phase1.stepper.labels.establishment' },
    { n: 2, key: 'phase1.stepper.labels.admin' },
    { n: 3, key: 'phase1.stepper.labels.configuration' },
    { n: 4, key: 'phase1.stepper.labels.confirmation' },
  ]

  const Stepper = (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)' }}>
          {t('phase1.stepper.step')} {step} / {STEPPER_LABELS.length}
        </span>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)' }}>
          {t(STEPPER_LABELS.find(s => s.n === step)?.key ?? '')}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${(step / STEPPER_LABELS.length) * 100}%`, background: 'linear-gradient(90deg,var(--green),var(--green2))', borderRadius: 3, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )

  // ── Right panel content ────────────────────────────────────────────────

  let content: React.ReactNode

  if (loadState === 'loading') {
    content = (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '60px 0', animation: 'edu-fadeUp 0.4s ease both' }}>
        <div style={{ width: 52, height: 52, border: '4px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.8s linear infinite' }} />
        <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text2)' }}>{t('phase1.loading.verifyingInvite')}</div>
      </div>
    )
  } else if (loadState === 'invalid' || loadState === 'expired' || loadState === 'used') {
    const info = {
      invalid:  { icon: Lock,        title: t('phase1.invite.invalid.title'),          color: 'var(--red)', bg: 'var(--red-light)', border: 'rgba(220,38,38,0.2)' },
      expired:  { icon: AlarmClock,  title: t('phase1.invite.expired.title'),     color: 'var(--amber)', bg: 'var(--amber-light)', border: 'rgba(217,119,6,0.2)' },
      used:     { icon: CheckCircle2, title: t('phase1.invite.used.title'), color: 'var(--green)', bg: 'var(--green-light)', border: 'rgba(142,42,58,0.2)' },
    }[loadState]
    const InfoIcon = info.icon
    content = (
      <div style={{ animation: 'edu-fadeUp 0.4s ease both', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', color: info.color, marginBottom: 20 }}><InfoIcon size={64} strokeWidth={2} /></div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 28, fontWeight: 700, color: 'var(--text)', marginBottom: 12 }}>{info.title}</div>
        <div style={{ padding: '16px 20px', background: info.bg, border: `1.5px solid ${info.border}`, borderRadius: 12, marginBottom: 24, fontSize: 15, fontWeight: 600, color: info.color, lineHeight: 1.6 }}>
          {errorMsg}
        </div>
        <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7 }}>
          {t('phase1.invite.helpText')} <strong>{t('phase1.invite.helpEmail')}</strong>
        </p>
      </div>
    )
  } else if (done) {
    content = (
      <div style={{ animation: 'edu-fadeUp 0.4s ease both', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--green)', marginBottom: 16 }}><PartyPopper size={72} strokeWidth={2} /></div>
        <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 30, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
          {t('phase1.done.title')}
        </div>
        <div style={{ padding: '16px 20px', background: 'var(--green-light)', border: '1.5px solid rgba(142,42,58,0.2)', borderRadius: 12, marginBottom: 20, fontSize: 15, fontWeight: 600, color: 'var(--green)', lineHeight: 1.8, display: 'flex', alignItems: 'flex-start', gap: 6, textAlign: 'left' }}>
          <CheckCircle2 size={17} strokeWidth={2} style={{ flexShrink: 0, marginTop: 2 }} /><span><strong>{form.nom}</strong> {t('phase1.done.pendingMsg')}<br />
          {t('phase1.done.emailNotice')} <strong>{form.adminEmail}</strong> {t('phase1.done.emailDelay')}</span>
        </div>

        {createdStats && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
            {createdStats.academicYear && (
              <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--card-bg, #f3f4f6)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                📅 {t('phase1.done.statsYear')} : <strong>{createdStats.academicYear}</strong>
              </div>
            )}
            {typeof createdStats.classCount === 'number' && (
              <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--card-bg, #f3f4f6)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                🏫 <strong>{createdStats.classCount}</strong> {t('phase1.done.statsClasses')}
              </div>
            )}
            {typeof createdStats.subjectCount === 'number' && (
              <div style={{ padding: '8px 14px', borderRadius: 8, background: 'var(--card-bg, #f3f4f6)', border: '1px solid var(--border)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
                📚 <strong>{createdStats.subjectCount}</strong> {t('phase1.done.statsSubjects')}
              </div>
            )}
          </div>
        )}

        <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 28 }}>
          {t('phase1.done.loginHint')}
        </p>

        <div>
          <a
            href="/login"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '14px 32px',
              background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
              color: 'white',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 16,
              textDecoration: 'none',
              boxShadow: '0 4px 12px rgba(142,42,58,0.25)',
            }}
          >
            {t('phase1.done.loginCta')} →
          </a>
        </div>
      </div>
    )
  } else {
    content = (
      <div style={{ animation: 'edu-fadeUp 0.35s ease both' }}>
        {/* Header */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 26, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
            {step === 1 ? t('phase1.step1.title') : step === 2 ? t('phase1.step2.title') : step === 3 ? t('phase1.step3.title') : t('phase1.step4.title')}
          </div>
          <div style={{ fontSize: 15, color: 'var(--text2)', fontWeight: 500 }}>
            {step === 1 ? t('phase1.step1.subtitle') : step === 2 ? t('phase1.step2.subtitle') : step === 3 ? t('phase1.step3.subtitle') : t('phase1.step4.subtitle')}
          </div>
        </div>

        {step <= 4 && Stepper}

        {stepError && <Alert msg={stepError} type="error" />}

        {/* ── STEP 1 ──────────────────────────────── */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <Field label={t('phase1.step1.schoolName.label')} required>
              <input className="edu-field" value={form.nom} style={INPUT}
                onChange={e => set('nom')(e.target.value)} placeholder={t('phase1.step1.schoolName.placeholder')} />
            </Field>

            <Field label={t('phase1.step1.subdomain.label')} required>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 13, fontWeight: 700, color: 'var(--text3)' }}>{t('phase1.step1.subdomain.prefix')}</span>
                <input className="edu-field" value={form.subdomain} style={{ ...INPUT, paddingLeft: 106 }}
                  onChange={e => { slRef.current = true; set('subdomain')(toSlug(e.target.value)) }}
                  placeholder={t('phase1.step1.subdomain.placeholder')} />
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontWeight: 600 }}>
                {t('phase1.step1.subdomain.hint')}
              </div>
            </Field>

            <Field label={t('phase1.step1.subsystem.label')} required>
              <RadioCards options={subsystemOptions} value={form.subsystem} onChange={(value) => {
                setSelectedTemplateCode(null)
                setStructure(null)
                setLevelFamily(null)
                setOffers([])
                setSecondarySpan(null)
                setWithTemplateReset('subsystem')(value)
              }} />
            </Field>

            {form.subsystem && (
              <Field label={t('phase1.step1.structure.label')} required>
                <RadioCards options={[
                  { value: 'MONO', label: t('phase1.step1.structure.options.MONO.label'), icon: School },
                  { value: 'COMPLEX', label: t('phase1.step1.structure.options.COMPLEX.label'), icon: GraduationCap },
                ]} value={structure ?? ''} onChange={(value) => {
                  const next = value as SchoolStructure
                  setStructure(next)
                  setSelectedTemplateCode(null)
                  if (next === 'COMPLEX') {
                    setLevelFamily(null)
                    setSecondarySpan(null)
                  }
                }} />
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 5, fontWeight: 600 }}>
                  {structure === 'COMPLEX' ? t('phase1.step1.structure.options.COMPLEX.desc') : structure === 'MONO' ? t('phase1.step1.structure.options.MONO.desc') : ''}
                </div>
              </Field>
            )}

            {structure === 'MONO' && (
              <Field label={t('phase1.step1.levelFamily.label')} required>
                <RadioCards options={[
                  { value: 'MATERNELLE_NURSERY', label: t('phase1.step1.levelFamily.options.MATERNELLE_NURSERY.label'), icon: School },
                  { value: 'PRIMARY', label: t('phase1.step1.levelFamily.options.PRIMARY.label'), icon: BookOpen },
                  { value: 'SECONDARY', label: t('phase1.step1.levelFamily.options.SECONDARY.label'), icon: GraduationCap },
                ]} value={levelFamily ?? ''} onChange={(value) => {
                  setLevelFamily(value as LevelFamily)
                  setSecondarySpan(null)
                  setSelectedTemplateCode(null)
                }} />
              </Field>
            )}

            {(structure === 'MONO' || structure === 'COMPLEX') && (
              <Field label={t('phase1.step1.offers.label')} required>
                <CheckboxGroup
                  options={(['GENERAL', 'TECHNICAL', 'PROFESSIONAL'] as OfferFlag[]).map((offer) => ({ value: offer, label: t(`phase1.step1.offers.${offer}`) }))}
                  values={offers}
                  onChange={(values) => {
                    const nextOffers = values as OfferFlag[]
                    setOffers(nextOffers)
                    setSecondarySpan(null)
                    setSelectedTemplateCode(null)
                  }}
                  note={structure === 'COMPLEX' ? t('phase1.step1.offers.complexHint') : t('phase1.step1.offers.hint')}
                />
              </Field>
            )}

            {structure === 'MONO' && levelFamily === 'SECONDARY' && offers.length > 0 && (
              <Field label={t('phase1.step1.secondarySpan.label')} required>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(offers.includes('GENERAL') ? (form.subsystem === 'FRANCOPHONE'
                    ? [{ value: 'TO_3E', label: t('phase1.step1.secondarySpan.TO_3E') }, { value: 'TO_TLE', label: t('phase1.step1.secondarySpan.TO_TLE') }]
                    : form.subsystem === 'ANGLOPHONE'
                      ? [{ value: 'TO_FORM5', label: t('phase1.step1.secondarySpan.TO_FORM5') }, { value: 'TO_UPPER_SIXTH', label: t('phase1.step1.secondarySpan.TO_UPPER_SIXTH') }]
                      : [{ value: 'TO_TLE', label: t('phase1.step1.secondarySpan.TO_TLE') }])
                    : []).concat(offers.includes('TECHNICAL') ? (form.subsystem === 'FRANCOPHONE'
                      ? [{ value: 'TECH_1ER', label: t('phase1.step1.secondarySpan.TECH_1ER') }, { value: 'TECH_FULL', label: t('phase1.step1.secondarySpan.TECH_FULL') }]
                      : [{ value: 'TECH_1ER', label: t('phase1.step1.secondarySpan.TECH_1ER') }, { value: 'TECH_FULL', label: t('phase1.step1.secondarySpan.TECH_FULL') }])
                      : []).concat(offers.includes('PROFESSIONAL') ? [{ value: 'PRO_SAR', label: t('phase1.step1.secondarySpan.PRO_SAR') }, { value: 'PRO_CFM', label: t('phase1.step1.secondarySpan.PRO_CFM') }] : []).map((option) => (
                    <button key={option.value} type="button" onClick={() => { setSecondarySpan(option.value as SecondarySpan); setSelectedTemplateCode(null) }}
                      style={{ padding: '9px 12px', border: `2px solid ${secondarySpan === option.value ? 'var(--green)' : 'var(--border2)'}`, borderRadius: 10, background: secondarySpan === option.value ? 'rgba(5,150,105,0.07)' : 'white', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: secondarySpan === option.value ? 'var(--green2)' : 'var(--text2)', textAlign: 'left' }}>
                      {option.label}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            <Field label={t('phase1.step1.ownership.label')} required>
              <RadioCards options={ownershipOptions} value={form.ownership} onChange={setWithTemplateReset('ownership')} />
            </Field>

            {/* Template détecté */}
            {template && (
              <div style={{
                padding: '12px 14px', background: 'rgba(5,150,105,0.06)',
                border: '1.5px solid rgba(142,42,58,0.2)', borderRadius: 12, marginBottom: 12,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                  {t('phase1.step1.templateDetected.title')}
                </div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--green2)' }}>
                  {templateDisplayName(template, currentLang === 'en' ? 'en' : 'fr')}
                </div>
                
                {/* Discriminating question: CES_FR vs LYCEE_FR */}
                {form.subsystem === 'FRANCOPHONE' && form.educationType === 'GENERAL' && form.ownership === 'PUBLIC' && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(5,150,105,0.15)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
                      {t('phase1.step1.templateDetected.cesOrLycee')}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        { code: 'LYCEE_FR', label: t('phase1.step1.templateDetected.lycee'), desc: t('phase1.step1.templateDetected.lyceeDesc') },
                        { code: 'CES_FR', label: t('phase1.step1.templateDetected.ces'), desc: t('phase1.step1.templateDetected.cesDesc') },
                      ].map(opt => {
                        const active = (selectedTemplateCode ?? template?.code) === opt.code
                        return (
                          <button key={opt.code} type="button" onClick={() => setSelectedTemplateCode(opt.code)}
                            style={{
                              flex: 1, padding: '8px 10px', border: `2px solid ${active ? 'var(--green)' : 'var(--border2)'}`,
                              borderRadius: 10, background: active ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: active ? 'var(--green2)' : 'var(--text2)',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            }}>
                            <span>{opt.label}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{opt.desc}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Discriminating question: GHS_EN vs GSS_EN */}
                {form.subsystem === 'ANGLOPHONE' && form.educationType === 'GENERAL' && form.ownership === 'PUBLIC' && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(5,150,105,0.15)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 6 }}>
                      {t('phase1.step1.templateDetected.ghsOrGss')}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        { code: 'GHS_EN', label: t('phase1.step1.templateDetected.ghs'), desc: t('phase1.step1.templateDetected.ghsDesc') },
                        { code: 'GSS_EN', label: t('phase1.step1.templateDetected.gss'), desc: t('phase1.step1.templateDetected.gssDesc') },
                      ].map(opt => {
                        const active = (selectedTemplateCode ?? template?.code) === opt.code
                        return (
                          <button key={opt.code} type="button" onClick={() => setSelectedTemplateCode(opt.code)}
                            style={{
                              flex: 1, padding: '8px 10px', border: `2px solid ${active ? 'var(--green)' : 'var(--border2)'}`,
                              borderRadius: 10, background: active ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: active ? 'var(--green2)' : 'var(--text2)',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            }}>
                            <span>{opt.label}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{opt.desc}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Catalogue template — sélection explicite (source backend) */}
            {templateCatalog.length > 0 && (
              <Field label={t('phase1.step1.modelSelect.label')}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {filteredTemplates.map(tmpl => {
                    const active = effectiveCode === tmpl.code
                    return (
                      <button key={tmpl.code} type="button" onClick={() => setSelectedTemplateCode(tmpl.code)}
                        style={{
                          padding: '8px 10px', border: `2px solid ${active ? 'var(--green)' : 'var(--border2)'}`,
                          borderRadius: 10, background: active ? 'rgba(5,150,105,0.07)' : 'white',
                          cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                          color: active ? 'var(--green2)' : 'var(--text2)', textAlign: 'left',
                        }}>
                        <div>{templateDisplayName(tmpl, currentLang === 'en' ? 'en' : 'fr')}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{tmpl.code} · {tmpl.subsystem} · {tmpl.educationType}</div>
                      </button>
                    )
                  })}
                </div>
                {filteredTemplates.length === 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic', marginTop: 6 }}>{t('phase1.step1.modelSelect.empty')}</div>
                )}
                {selectedTemplateCode === null && suggestedCode && templateCatalog.some(t => t.code === suggestedCode) && (
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)' }}>
                    {t('phase1.step1.modelSelect.suggestion')} : <strong>{templateDisplayName(templateCatalog.find(t => t.code === suggestedCode)!, currentLang === 'en' ? 'en' : 'fr')}</strong>
                    <button type="button" onClick={() => setSelectedTemplateCode(suggestedCode)}
                      style={{ marginLeft: 8, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--green)', background: 'var(--green)', color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>
                      {t('phase1.step1.modelSelect.useSuggestion')}
                    </button>
                  </div>
                )}
              </Field>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label={t('phase1.step1.city.label')}>
                <input className="edu-field" value={form.ville} style={INPUT}
                  onChange={e => set('ville')(e.target.value)} placeholder={t('phase1.step1.city.placeholder')} />
              </Field>
              <Field label={t('phase1.step1.region.label')}>
                <select className="edu-field" value={form.region} style={{ ...INPUT, appearance: 'none', backgroundImage: 'none' }}
                  onChange={e => set('region')(e.target.value)}>
                  <option value="">{t('common.selectRegion')}</option>
                  {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </Field>
            </div>

            <Field label={t('phase1.step1.phone.label')}>
              <input className="edu-field" value={form.telephone} style={INPUT}
                onChange={e => set('telephone')(e.target.value)} placeholder={t('phase1.step1.phone.placeholder')} />
            </Field>

            {/* Logo upload */}
            <Field label={t('phase1.step1.logo.label')}>
              <input ref={logoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoUpload} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {/* Preview or placeholder */}
                <div onClick={() => logoInputRef.current?.click()}
                  style={{ width: 72, height: 72, borderRadius: 14, border: `2px dashed ${form.logoBase64 ? 'var(--green)' : 'var(--border2)'}`, background: form.logoBase64 ? 'transparent' : 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, transition: 'all 0.15s' }}>
                  {form.logoBase64
                    ? <img src={form.logoBase64} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <School size={28} strokeWidth={2} style={{ color: 'var(--text3)' }} />}
                </div>
                <div>
                  <button type="button" onClick={() => logoInputRef.current?.click()}
                    style={{ padding: '9px 16px', border: '1.5px solid var(--border2)', borderRadius: 9, background: 'var(--surface)', fontSize: 14, fontWeight: 700, color: 'var(--text2)', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 6 }}>
                    {form.logoBase64 ? t('phase1.step1.logo.change') : t('phase1.step1.logo.upload')}
                  </button>
                  <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{t('phase1.step1.logo.hint')}</div>
                  {form.logoBase64 && (
                    <button type="button" onClick={() => set('logoBase64')('')}
                      style={{ marginTop: 4, fontSize: 12, fontWeight: 700, color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                      {t('phase1.step1.logo.remove')}
                    </button>
                  )}
                </div>
              </div>
            </Field>

            <SubmitBtn onClick={goNext}>{t('phase1.buttons.step1Submit')}</SubmitBtn>
          </div>
        )}

        {/* ── STEP 2 ──────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <button type="button" onClick={() => { setStep(1); setStepError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 16, padding: 0 }}>
              {t('phase1.step2.back')}
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label={t('phase1.step2.firstName.label')} required>
                <input className="edu-field" value={form.adminPrenom} style={INPUT}
                  onChange={e => set('adminPrenom')(e.target.value)} placeholder={t('phase1.step2.firstName.placeholder')} />
              </Field>
              <Field label={t('phase1.step2.lastName.label')} required>
                <input className="edu-field" value={form.adminNom} style={INPUT}
                  onChange={e => set('adminNom')(e.target.value)} placeholder={t('phase1.step2.lastName.placeholder')} />
              </Field>
            </div>

            <Field label={t('phase1.step2.email.label')} required>
              <input className="edu-field" type="email" value={form.adminEmail} style={INPUT}
                onChange={e => set('adminEmail')(e.target.value)} placeholder={t('phase1.step2.email.placeholder')} />
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4, fontWeight: 600 }}>
                {t('phase1.step2.email.hint')}
              </div>
            </Field>

            <Field label={t('phase1.step2.password.label')} required>
              <div style={{ position: 'relative' }}>
                <input className="edu-field" type={showPwd ? 'text' : 'password'} value={form.password}
                  style={{ ...INPUT, paddingRight: 44 }}
                  onChange={e => set('password')(e.target.value)} placeholder={t('phase1.step2.password.placeholder')} />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text3)' }}>
                  {showPwd ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                </button>
              </div>
              {form.password && <PasswordStrengthBar password={form.password} />}
            </Field>

            <Field label={t('phase1.step2.confirmPassword.label')} required>
              <div style={{ position: 'relative' }}>
                <input className="edu-field" type={showConfirm ? 'text' : 'password'} value={form.confirmPassword}
                  style={{ ...INPUT, paddingRight: 44, borderColor: form.confirmPassword && form.confirmPassword !== form.password ? 'var(--red)' : 'var(--border2)' }}
                  onChange={e => set('confirmPassword')(e.target.value)} placeholder={t('phase1.step2.confirmPassword.placeholder')} />
                <button type="button" onClick={() => setShowConfirm(s => !s)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', color: 'var(--text3)' }}>
                  {showConfirm ? <EyeOff size={18} strokeWidth={2} /> : <Eye size={18} strokeWidth={2} />}
                </button>
              </div>
              {form.confirmPassword && form.confirmPassword !== form.password && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4, fontWeight: 700 }}>{t('phase1.step2.confirmPassword.mismatch')}</div>
              )}
            </Field>

            <SubmitBtn onClick={goNext}>{t('phase1.buttons.step2Submit')}</SubmitBtn>
          </div>
        )}

        {/* ── STEP 3 — Configuration ─────────────── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <button type="button" onClick={() => { setStep(2); setStepError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 14, padding: 0 }}>
              {t('phase1.step3.back')}
            </button>

            {/* Q4 — Template détecté */}
            {template && !template.isComplexe && (
              <div style={{
                padding: '14px 16px', background: 'rgba(5,150,105,0.06)',
                border: '1.5px solid rgba(142,42,58,0.2)', borderRadius: 12, marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                  {t('phase1.step3.templateDetected.title')}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--green2)' }}>
                  {templateDisplayName(template, currentLang === 'en' ? 'en' : 'fr')}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                  {t('phase1.step3.templateDetected.hint')}
                </div>
              </div>
            )}

            {template?.isComplexe && (
              <div style={{
                padding: '16px 18px', background: 'var(--amber-light)',
                border: '1.5px solid rgba(217,119,6,0.25)', borderRadius: 12, marginBottom: 16,
              }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--amber)', marginBottom: 6 }}>
                  {t('phase1.step3.complexe.title')}
                </div>
                <div style={{ fontSize: 14, color: 'var(--amber)', fontWeight: 600, lineHeight: 1.6 }}>
                  {t('phase1.step3.complexe.msgAvailable')}
                </div>
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 8, fontWeight: 600 }}>
                  {t('phase1.step3.complexe.hintAvailable')}
                </div>
              </div>
            )}

            {!template && (
              <Alert msg={t('phase1.step3.noTemplate')} type="error" />
            )}

            {/* ── GROUPE A — 1er cycle ── */}
            {template && template.hasPremierCycle && (
              <div style={{ marginTop: 4, marginBottom: 8 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: 'var(--text)',
                  padding: '8px 0', borderBottom: '2px solid var(--green)', marginBottom: 14,
                }}>
                  {t('phase1.step3.firstCycle.sectionTitle')}
                </div>

                {/* Q5 — Niveaux */}
                <Field label={t('phase1.step3.firstCycle.q5')}>
                  <CheckboxGroup
                    options={
                      // GTC_EN/GTC_GTHS_EN (technique anglophone) : Form1→Form4, PAS la
                      // numérotation CAP1-4 (francophone uniquement) ni le split EN_LOWER/full
                      // (propre au général anglophone GHS_EN/GSS_EN) — voir Phase 0 de ce chantier.
                      form.subsystem === 'ANGLOPHONE' && form.educationType === 'TECHNICAL'
                        ? NIVEAUX_1ER_CYCLE_EN.slice(0, 4).map(v => ({ value: v, label: v }))
                        : form.educationType === 'TECHNICAL'
                          ? NIVEAUX_1ER_CYCLE_CAP.map(v => ({ value: v, label: v }))
                          : form.subsystem === 'ANGLOPHONE'
                            ? (template?.hasDeuxiemeCycle ? NIVEAUX_1ER_CYCLE_EN_LOWER : NIVEAUX_1ER_CYCLE_EN).map(v => ({ value: v, label: v }))
                            : NIVEAUX_1ER_CYCLE_FR.map(v => ({ value: v, label: v }))
                    }
                    values={form.niveaux1erCycle}
                    onChange={v => setForm(f => ({
                      ...f,
                      niveaux1erCycle: v,
                      classesParNiveau: v.reduce((acc, lvl) => ({
                        ...acc,
                        [lvl]: f.classesParNiveau[lvl] ?? 2,
                      }), {} as Record<string, number>),
                    }))}
                  />
                </Field>

                {/* Q6 — Nombre de classes par niveau */}
                {form.niveaux1erCycle.length > 0 && (
                  <Field label={t('phase1.step3.firstCycle.q6')}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {form.niveaux1erCycle.map(niveau => (
                        <div key={niveau} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 50, fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{niveau}</div>
                          <StepperBtns
                            value={form.classesParNiveau[niveau] ?? 2}
                            onChange={v => setNiveauCount(niveau, v)}
                          />
                        </div>
                      ))}
                    </div>
                  </Field>
                )}

                {/* Q7 — Convention de nommage */}
                <Field label={t('phase1.step3.firstCycle.q7')}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {conventionOptions.map(opt => {
                      const active = form.conventionNommage === opt.value
                      return (
                        <label key={opt.value}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                            border: `2px solid ${active ? 'var(--green)' : 'var(--border2)'}`,
                            borderRadius: 10, background: active ? 'rgba(5,150,105,0.07)' : 'white',
                            cursor: 'pointer', transition: 'all 0.15s',
                          }}>
                          <input type="radio" name="convention" value={opt.value}
                            checked={active} onChange={() => set('conventionNommage')(opt.value)}
                            style={{ accentColor: 'var(--green)' }} />
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: active ? 'var(--green2)' : 'var(--text)' }}>
                              {opt.label}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>{opt.desc}</div>
                          </div>
                        </label>
                      )
                    })}
                  </div>

                  {/* Aperçu temps réel */}
                  {form.niveaux1erCycle.length > 0 && (
                    <div style={{
                      marginTop: 10, padding: '10px 14px', background: 'var(--bg2)',
                      border: '1.5px solid var(--border)', borderRadius: 10,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', marginBottom: 4 }}>{t('phase1.step3.firstCycle.previewLabel')}</div>
                      <ClassPreview
                        levels={form.niveaux1erCycle.map(l => ({ level: l, count: form.classesParNiveau[l] ?? 2 }))}
                        convention={form.conventionNommage}
                        emptyLabel={t('common.emptyClasses')}
                      />
                    </div>
                  )}
                </Field>

                {/* Q8 — LV2 début (si 4e ou 3e présent) */}
                {(form.niveaux1erCycle.includes('4e') || form.niveaux1erCycle.includes('3e')) && (
                  <Field label={t('phase1.step3.lv2.q8')}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['4e', '3e', 'NON_APPLICABLE'].map(opt => (
                        <button key={opt} type="button" onClick={() => set('lv2Debut')(opt)}
                          style={{
                            flex: 1, padding: '10px 8px', border: `2px solid ${form.lv2Debut === opt ? 'var(--green)' : 'var(--border2)'}`,
                            borderRadius: 10, background: form.lv2Debut === opt ? 'rgba(5,150,105,0.07)' : 'white',
                            cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                            color: form.lv2Debut === opt ? 'var(--green2)' : 'var(--text2)',
                          }}>
                          {opt === 'NON_APPLICABLE' ? t('phase1.step3.lv2.nonApplicable') : `${t('phase1.step3.lv2.fromLevel')} ${opt}`}
                        </button>
                      ))}
                    </div>
                  </Field>
                )}

                {/* Q9 — LV2 disponibles (si Q8 ≠ NON_APPLICABLE) */}
                {form.lv2Debut !== 'NON_APPLICABLE' && form.lv2Debut !== '' && (
                  <Field label={t('phase1.step3.lv2.q9')}>
                    <CheckboxGroup
                      options={LV2_OPTIONS.map(v => ({ value: v, label: t('phase1.lv2Languages.' + v) }))}
                      values={form.lv2Disponibles}
                      onChange={v => setForm(f => ({ ...f, lv2Disponibles: v }))}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>{t('phase1.step3.lv2.other')}</span>
                      <input className="edu-field" value={customLv2}
                        style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 180 }}
                        onChange={e => setCustomLv2(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && customLv2.trim() && !form.lv2Disponibles.includes(customLv2.trim())) {
                            setForm(f => ({ ...f, lv2Disponibles: [...f.lv2Disponibles, customLv2.trim()] }))
                            setCustomLv2('')
                          }
                        }}
                        placeholder={t('phase1.step3.lv2.placeholder')} />
                      <button type="button" onClick={() => {
                        if (customLv2.trim() && !form.lv2Disponibles.includes(customLv2.trim())) {
                          setForm(f => ({ ...f, lv2Disponibles: [...f.lv2Disponibles, customLv2.trim()] }))
                          setCustomLv2('')
                        }
                      }}
                        style={{
                          padding: '7px 12px', background: 'var(--green)', color: 'white', border: 'none',
                          borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                        }}>
                        {t('phase1.step3.lv2.add')}
                      </button>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, fontWeight: 600, lineHeight: 1.5 }}>
                      {t('phase1.step3.lv2.hint')}
                    </div>
                  </Field>
                )}
              </div>
            )}

            {/* ── GROUPE B — 2e cycle ── */}
            {template && !template.isComplexe && template.code === 'CES_FR' && (
              <div style={{ marginTop: 8, marginBottom: 8 }}>
                <Alert msg={t('phase1.step3.secondCycle.cesNotice')} type="info" />
              </div>
            )}
            {template && template.hasDeuxiemeCycle && !['CES_FR', 'GTC_GTHS_EN'].includes(template.code ?? '') && (
              <div style={{ marginTop: 8, marginBottom: 8 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: 'var(--text)',
                  padding: '8px 0', borderBottom: '2px solid var(--blue)', marginBottom: 14,
                }}>
                  {['GHS_EN','GSS_EN','PRIVE_EN'].includes(template.code ?? '') ? t('phase1.step3.secondCycle.sectionTitleEN') : t('phase1.step3.secondCycle.sectionTitleFR')}
                </div>

                {/* GSS_EN — O-Level only notice */}
                {template.code === 'GSS_EN' && (
                  <Alert msg={t('phase1.step3.secondCycle.gssNotice')} type="info" />
                )}

                {/* Q10 — Niveaux 2e cycle */}
                {['GHS_EN','GSS_EN','PRIVE_EN'].includes(template.code ?? '') ? (
                  <Field label={t('phase1.step3.secondCycle.q10EN')}>
                    <CheckboxGroup
                      options={(
                        template.code === 'GSS_EN'
                          ? ['Form 4','Form 5']
                          : ['Form 4','Form 5','Lower Sixth','Upper Sixth']
                      ).map(v => ({ value: v, label: v }))}
                      values={form.niveaux2eCycle}
                      onChange={v => setForm(f => ({ ...f, niveaux2eCycle: v }))}
                    />
                  </Field>
                ) : (
                  <Field label={t('phase1.step3.secondCycle.q10FR')}>
                    <CheckboxGroup
                      options={
                        form.subsystem === 'ANGLOPHONE'
                          ? NIVEAUX_2E_CYCLE_EN.map(v => ({ value: v, label: v }))
                          : NIVEAUX_2E_CYCLE_FR.map(v => ({ value: v, label: v }))
                      }
                      values={form.niveaux2eCycle}
                      onChange={v => setForm(f => ({ ...f, niveaux2eCycle: v }))}
                    />
                  </Field>
                )}

                {/* Q11 — Filières (FR) ou Streams (EN) */}
                {form.niveaux2eCycle.length > 0 && (
                  ['GHS_EN','GSS_EN','PRIVE_EN'].includes(template.code ?? '') ? (
                    <div>
                      <Field label={t('phase1.step3.secondCycle.q11EN')}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.secondCycle.artsEN')}</div>
                            <CheckboxGroup
                              options={FILIERES_EN_ARTS.map(v => ({ value: v, label: v }))}
                              values={form.filieres}
                              onChange={v => setForm(f => ({ ...f, filieres: v }))}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.secondCycle.sciencesEN')}</div>
                            <CheckboxGroup
                              options={FILIERES_EN_SCIENCES.map(v => ({ value: v, label: v }))}
                              values={form.filieres}
                              onChange={v => setForm(f => ({ ...f, filieres: v }))}
                            />
                          </div>
                        </div>
                      </Field>
                      {template.code !== 'GSS_EN' && (
                        <Field label={t('phase1.step3.secondCycle.streamStart')}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {([
                              { value: 'FORM4', label: t('phase1.step3.secondCycle.form4') },
                              { value: 'FORM5', label: t('phase1.step3.secondCycle.form5') },
                              { value: 'SIXTH', label: t('phase1.step3.secondCycle.lowerSixthOnly') },
                            ] as const).map(opt => (
                              <button key={opt.value} type="button" onClick={() => setEnStreamStartLevel(opt.value)}
                                style={{
                                  flex: 1, padding: '10px 8px', border: `2px solid ${enStreamStartLevel === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                                  borderRadius: 10, background: enStreamStartLevel === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                                  color: enStreamStartLevel === opt.value ? 'var(--green2)' : 'var(--text2)',
                                }}>
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </Field>
                      )}
                      <Field label={t('phase1.step3.secondCycle.grading')}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {([
                            { value: 'OVER_20',  label: t('phase1.step3.secondCycle.marks20') },
                            { value: 'OVER_100', label: t('phase1.step3.secondCycle.marks100') },
                          ] as const).map(opt => (
                            <button key={opt.value} type="button" onClick={() => setEnGradingSystem(opt.value)}
                              style={{
                                flex: 1, padding: '10px 8px', border: `2px solid ${enGradingSystem === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                                borderRadius: 10, background: enGradingSystem === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                                cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                                color: enGradingSystem === opt.value ? 'var(--green2)' : 'var(--text2)',
                              }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </Field>
                    </div>
                  ) : (
                    <Field label={t('phase1.step3.secondCycle.q11FR')}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.secondCycle.literarySection')}</div>
                          <CheckboxGroup
                            options={FILIERES_LITT.map(v => ({ value: v, label: v }))}
                            values={form.filieres}
                            onChange={v => setForm(f => ({ ...f, filieres: v }))}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.secondCycle.scienceSection')}</div>
                          <CheckboxGroup
                            options={FILIERES_SCIENT.map(v => ({ value: v, label: v }))}
                            values={form.filieres}
                            onChange={v => setForm(f => ({ ...f, filieres: v }))}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.secondCycle.technicalSection')}</div>
                          <CheckboxGroup
                            options={FILIERES_TECH.map(v => ({ value: v, label: v }))}
                            values={form.filieres}
                            onChange={v => setForm(f => ({ ...f, filieres: v }))}
                          />
                        </div>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.secondCycle.otherSection')}</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <input className="edu-field" value={customFiliere}
                              style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 250 }}
                              onChange={e => setCustomFiliere(e.target.value)}
                              onKeyDown={e => {
                                if (e.key === 'Enter' && customFiliere.trim() && !form.filieres.includes(customFiliere.trim())) {
                                  setForm(f => ({ ...f, filieres: [...f.filieres, customFiliere.trim()] }))
                                  setCustomFiliere('')
                                }
                              }}
                              placeholder={t('phase1.step3.secondCycle.placeholder')} />
                            <button type="button" onClick={() => {
                              if (customFiliere.trim() && !form.filieres.includes(customFiliere.trim())) {
                                setForm(f => ({ ...f, filieres: [...f.filieres, customFiliere.trim()] }))
                                setCustomFiliere('')
                              }
                            }}
                              style={{ padding: '7px 12px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                              {t('phase1.step3.secondCycle.add')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </Field>
                  )
                )}

                {/* Q12 — Langues A4 (si A4 coché, FR uniquement) */}
                {!['GHS_EN','GSS_EN','PRIVE_EN'].includes(template.code ?? '') && form.filieres.some(f => f.startsWith('A4') || f.includes('A4')) && (
                  <Field label={t('phase1.step3.secondCycle.q12')}>
                    <CheckboxGroup
                      options={LV2_OPTIONS.map(v => ({ value: v, label: t('phase1.lv2Languages.' + v) }))}
                      values={form.a4Languages}
                      onChange={v => setForm(f => ({ ...f, a4Languages: v }))}
                    />
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>{t('phase1.step3.secondCycle.other')}</span>
                      <input className="edu-field" value={customA4}
                        style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 180 }}
                        onChange={e => setCustomA4(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter' && customA4.trim() && !form.a4Languages.includes(customA4.trim())) {
                            setForm(f => ({ ...f, a4Languages: [...f.a4Languages, customA4.trim()] }))
                            setCustomA4('')
                          }
                        }}
                        placeholder={t('phase1.step3.secondCycle.placeholder')} />
                      <button type="button" onClick={() => {
                        if (customA4.trim() && !form.a4Languages.includes(customA4.trim())) {
                          setForm(f => ({ ...f, a4Languages: [...f.a4Languages, customA4.trim()] }))
                          setCustomA4('')
                        }
                      }}
                        style={{ padding: '7px 12px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        {t('phase1.step3.secondCycle.add')}
                      </button>
                    </div>
                  </Field>
                )}

                {/* Q13 — Classes par filière (FR uniquement) */}
                {!['GHS_EN','GSS_EN','PRIVE_EN'].includes(template.code ?? '') && form.filieres.length > 0 && (
                  <Field label={t('phase1.step3.secondCycle.q13')}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {[
                        { value: '1', label: t('phase1.step3.secondCycle.oneClass') },
                        { value: '2', label: t('phase1.step3.secondCycle.twoClasses') },
                        { value: '3+', label: t('phase1.step3.secondCycle.threePlusClasses') },
                      ].map(opt => (
                        <button key={opt.value} type="button" onClick={() => set('classesParFiliere')(opt.value)}
                          style={{
                            flex: 1, padding: '10px 8px', border: `2px solid ${form.classesParFiliere === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                            borderRadius: 10, background: form.classesParFiliere === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                            cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                            color: form.classesParFiliere === opt.value ? 'var(--green2)' : 'var(--text2)',
                          }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                    {form.a4Languages.length > 0 && (
                      <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, fontWeight: 600 }}>
                        {t('phase1.step3.secondCycle.a4Hint')}
                      </div>
                    )}
                  </Field>
                )}

              </div>
            )}

            {/* PSB / PEBS — Programme Spécial Bilingue : variable ORTHOGONALE au cycle, disponible
                pour tout template général éligible (y compris un CES à 1er cycle seul), jamais le
                technique. Le backend crée une classe bilingue au 1er rang de chaque niveau. */}
            {template && !template.isComplexe && template.code && isPebsFrEligible(template.code) && (
              <Field label={t('phase1.step3.secondCycle.pebsFR')}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([{ v: true, l: t('phase1.step3.secondCycle.pebsYes') }, { v: false, l: t('phase1.step3.secondCycle.pebsNo') }]).map(opt => (
                    <button key={String(opt.v)} type="button" onClick={() => setHasPEBSFrancophone(opt.v)}
                      style={{
                        flex: 1, padding: '10px 8px', border: `2px solid ${hasPEBSFrancophone === opt.v ? 'var(--green)' : 'var(--border2)'}`,
                        borderRadius: 10, background: hasPEBSFrancophone === opt.v ? 'rgba(5,150,105,0.07)' : 'white',
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                        color: hasPEBSFrancophone === opt.v ? 'var(--green2)' : 'var(--text2)',
                      }}>
                      {opt.l}
                    </button>
                  ))}
                </div>
                {hasPEBSFrancophone && (
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, fontWeight: 600 }}>
                    {t('phase1.step3.secondCycle.pebsFRHint')}
                  </div>
                )}
              </Field>
            )}
            {template && !template.isComplexe && template.code && isPebsEnEligible(template.code) && (
              <Field label={t('phase1.step3.secondCycle.pebsEN')}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {([{ v: true, l: t('phase1.step3.secondCycle.pebsYesEN') }, { v: false, l: t('phase1.step3.secondCycle.pebsNoEN') }]).map(opt => (
                    <button key={String(opt.v)} type="button" onClick={() => setHasPEBSAnglophone(opt.v)}
                      style={{
                        flex: 1, padding: '10px 8px', border: `2px solid ${hasPEBSAnglophone === opt.v ? 'var(--green)' : 'var(--border2)'}`,
                        borderRadius: 10, background: hasPEBSAnglophone === opt.v ? 'rgba(5,150,105,0.07)' : 'white',
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                        color: hasPEBSAnglophone === opt.v ? 'var(--green2)' : 'var(--text2)',
                      }}>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </Field>
            )}

            {/* ── LYCEE_BILINGUE — Section Anglophone ── */}
            {template && template.code === 'LYCEE_BILINGUE' && (
              <div style={{ marginTop: 8, marginBottom: 8 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: 'var(--text)',
                  padding: '8px 0', borderBottom: '2px solid var(--blue)', marginBottom: 14,
                }}>
                  {t('phase1.step3.secondCycle.bilingualSection')}
                </div>
                <Field label={t('phase1.step3.bilingual.levels')}>
                  <CheckboxGroup
                    options={NIVEAUX_EN_FULL.map(v => ({ value: v, label: v }))}
                    values={bilingualEnLevels}
                    onChange={setBilingualEnLevels}
                  />
                </Field>
                {bilingualEnLevels.length > 0 && (
                  <Field label={t('phase1.step3.bilingual.streams')}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.bilingual.arts')}</div>
                        <CheckboxGroup
                          options={FILIERES_EN_ARTS.map(v => ({ value: v, label: v }))}
                          values={bilingualEnFilieres}
                          onChange={setBilingualEnFilieres}
                        />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.bilingual.sciences')}</div>
                        <CheckboxGroup
                          options={FILIERES_EN_SCIENCES.map(v => ({ value: v, label: v }))}
                          values={bilingualEnFilieres}
                          onChange={setBilingualEnFilieres}
                        />
                      </div>
                    </div>
                  </Field>
                )}
                <Field label={t('phase1.step3.bilingual.grading')}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([
                      { value: 'OVER_20',  label: t('phase1.step3.bilingual.marks20') },
                      { value: 'OVER_100', label: t('phase1.step3.bilingual.marks100') },
                    ] as const).map(opt => (
                      <button key={opt.value} type="button" onClick={() => setEnGradingSystem(opt.value)}
                        style={{
                          flex: 1, padding: '10px 8px', border: `2px solid ${enGradingSystem === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                          borderRadius: 10, background: enGradingSystem === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                          cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                          color: enGradingSystem === opt.value ? 'var(--green2)' : 'var(--text2)',
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
            )}

            {/* ── GROUPE B-bis — 2e cycle GTC_GTHS_EN (Lower/Upper Sixth technique, STT/IND) ──
                La filière (STT/IND) est choisie une seule fois pour toute l'école dans le
                GROUPE C ci-dessous ; ce bloc ne demande que les niveaux du 2e cycle. */}
            {template && template.code === 'GTC_GTHS_EN' && (
              <div style={{ marginTop: 8, marginBottom: 8 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: 'var(--text)',
                  padding: '8px 0', borderBottom: '2px solid var(--blue)', marginBottom: 14,
                }}>
                  {t('phase1.step3.secondCycle.sectionTitleEN')}
                </div>
                <Field label={t('phase1.step3.secondCycle.q10EN')}>
                  <CheckboxGroup
                    options={NIVEAUX_2E_CYCLE_EN.map(v => ({ value: v, label: v }))}
                    values={form.niveaux2eCycle}
                    onChange={v => setForm(f => ({ ...f, niveaux2eCycle: v }))}
                  />
                </Field>
              </div>
            )}

            {/* ── GROUPE C — Technique / professionnel ── */}
            {template && showTechniqueBlocks(template, offers) && (
              <div style={{ marginTop: 8, marginBottom: 8 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: 'var(--text)',
                  padding: '8px 0', borderBottom: '2px solid var(--amber)', marginBottom: 14,
                }}>
                  {t('phase1.step3.technical.sectionTitle')}
                </div>

                {template.isComplexe && offers.includes('TECHNICAL') && (
                  <Field label={t('phase1.step3.technical.q14Tech')}>
                    <CheckboxGroup
                      options={FILIERES_TECHNIQUES_OFF.map(v => ({ value: v, label: v }))}
                      values={form.filieresTechniques}
                      onChange={v => setForm(f => ({ ...f, filieresTechniques: v }))}
                    />
                  </Field>
                )}

                {template.isComplexe && offers.includes('PROFESSIONAL') && (
                  <div>
                    <Field label={t('phase1.step3.technical.sarMetiers')}>
                      <CheckboxGroup
                        options={SAR_METIERS_OPTIONS.map(v => ({ value: v, label: t('phase1.sarMetiers.' + v) }))}
                        values={sarMetiers}
                        onChange={setSarMetiers}
                      />
                    </Field>
                    <Field label={t('phase1.step3.technical.cfmFilieres')}>
                      <CheckboxGroup
                        options={CFM_FILIERES_OPTIONS.map(v => ({ value: v, label: t('phase1.cfmFilieres.' + v) }))}
                        values={cfmFilieres}
                        onChange={setCfmFilieres}
                      />
                    </Field>
                  </div>
                )}

                {/* Admission (Q_ADMISSION) — visible pour TOUT template technique (CETIC,
                    LYCEE_TECHNIQUE_FR, GTC_EN, GTC_GTHS_EN...) : GGTC/CETIF partagent le même
                    programme que la variante mixte, seule l'admission diffère. Jamais imposé
                    ailleurs (voir School.admissionType). */}
                <Field label={t('phase1.step3.technical.admissionType')}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {([
                      { value: 'MIXTE',   label: t('phase1.step3.technical.admissionMixte') },
                      { value: 'FILLES',  label: t('phase1.step3.technical.admissionFilles') },
                      { value: 'GARCONS', label: t('phase1.step3.technical.admissionGarcons') },
                    ] as const).map(opt => (
                      <button key={opt.value} type="button" onClick={() => setForm(f => ({ ...f, admissionType: opt.value }))}
                        style={{
                          flex: 1, padding: '10px 6px', border: `2px solid ${form.admissionType === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                          borderRadius: 10, background: form.admissionType === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                          cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                          color: form.admissionType === opt.value ? 'var(--green2)' : 'var(--text2)',
                        }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </Field>

                {/* SAR_SM — formulaire minimal métiers */}
                {template.code === 'SAR_SM' && (
                  <div>
                    <div style={{ padding: '10px 14px', background: 'var(--amber-light)', border: '1.5px solid var(--amber-light)', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 700, color: 'var(--amber)' }}>
                      {t('phase1.step3.technical.sarNotice')}
                    </div>
                    <Field label={t('phase1.step3.technical.sarMetiers')}>
                      <CheckboxGroup
                        options={SAR_METIERS_OPTIONS.map(v => ({ value: v, label: t('phase1.sarMetiers.' + v) }))}
                        values={sarMetiers}
                        onChange={setSarMetiers}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>{t('phase1.step3.technical.autres')}</span>
                        <input className="edu-field" value={customSarMetier}
                          style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 220 }}
                          onChange={e => setCustomSarMetier(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && customSarMetier.trim() && !sarMetiers.includes(customSarMetier.trim())) {
                              setSarMetiers(m => [...m, customSarMetier.trim()]); setCustomSarMetier('')
                            }
                          }}
                          placeholder={t('phase1.step3.technical.placeholder')} />
                        <button type="button" onClick={() => {
                          if (customSarMetier.trim() && !sarMetiers.includes(customSarMetier.trim())) {
                            setSarMetiers(m => [...m, customSarMetier.trim()]); setCustomSarMetier('')
                          }
                        }}
                          style={{ padding: '7px 12px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {t('phase1.step3.technical.add')}
                        </button>
                      </div>
                    </Field>
                    <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>
                      {t('phase1.step3.technical.sarHint')}
                    </div>
                  </div>
                )}

                {/* CFM — formulaire minimal filières */}
                {template.code === 'CFM' && (
                  <div>
                    <Field label={t('phase1.step3.technical.cfmFilieres')}>
                      <CheckboxGroup
                        options={CFM_FILIERES_OPTIONS.map(v => ({ value: v, label: t('phase1.cfmFilieres.' + v) }))}
                        values={cfmFilieres}
                        onChange={setCfmFilieres}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)' }}>{t('phase1.step3.technical.autres')}</span>
                        <input className="edu-field" value={customCfmFiliere}
                          style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 220 }}
                          onChange={e => setCustomCfmFiliere(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && customCfmFiliere.trim() && !cfmFilieres.includes(customCfmFiliere.trim())) {
                              setCfmFilieres(m => [...m, customCfmFiliere.trim()]); setCustomCfmFiliere('')
                            }
                          }}
                          placeholder={t('phase1.step3.technical.placeholder')} />
                        <button type="button" onClick={() => {
                          if (customCfmFiliere.trim() && !cfmFilieres.includes(customCfmFiliere.trim())) {
                            setCfmFilieres(m => [...m, customCfmFiliere.trim()]); setCustomCfmFiliere('')
                          }
                        }}
                          style={{ padding: '7px 12px', background: 'var(--green)', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {t('phase1.step3.technical.add')}
                        </button>
                      </div>
                    </Field>
                    <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>
                      {t('phase1.step3.technical.cfmHint')}
                    </div>
                  </div>
                )}

                {/* LYCEE_TECHNIQUE_FR — Q_TECH + Q14 filtré */}
                {template.code === 'LYCEE_TECHNIQUE_FR' && (
                  <div>
                    <Field label={t('phase1.step3.technical.lyceeTechType')}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([
                          { value: 'IND',   label: t('phase1.step3.technical.industriel'),  desc: t('phase1.step3.technical.industrielDesc') },
                          { value: 'STT',   label: t('phase1.step3.technical.tertiaire'),   desc: t('phase1.step3.technical.tertiaireDesc') },
                          { value: 'MIXTE', label: t('phase1.step3.technical.mixte'),   desc: t('phase1.step3.technical.mixteDesc') },
                        ] as const).map(opt => (
                          <button key={opt.value} type="button" onClick={() => setSousTypeTechnique(opt.value)}
                            style={{
                              flex: 1, padding: '10px 6px', border: `2px solid ${sousTypeTechnique === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                              borderRadius: 10, background: sousTypeTechnique === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: sousTypeTechnique === opt.value ? 'var(--green2)' : 'var(--text2)',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            }}>
                            <span>{opt.label}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </Field>
                    {sousTypeTechnique && (
                      <Field label={t('phase1.step3.technical.q14')}>
                        <CheckboxGroup
                          options={(
                            sousTypeTechnique === 'IND' ? FILIERES_TECHNIQUES_OFF.filter(f => f.startsWith('F'))
                            : sousTypeTechnique === 'STT' ? FILIERES_TECHNIQUES_OFF.filter(f => f.startsWith('G'))
                            : FILIERES_TECHNIQUES_OFF
                          ).map(v => ({ value: v, label: v }))}
                          values={form.filieresTechniques}
                          onChange={v => setForm(f => ({ ...f, filieresTechniques: v }))}
                        />
                      </Field>
                    )}
                  </div>
                )}

                {/* GTC_EN / GTC_GTHS_EN — miroir anglophone du bloc LYCEE_TECHNIQUE_FR
                    ci-dessus, filières STT (Tertiary) & IND (Industrial) directement (pas de
                    sous-codes numérotés comme F1/G2 francophone — voir anglophone/technical.ts). */}
                {(template.code === 'GTC_EN' || template.code === 'GTC_GTHS_EN') && (
                  <div>
                    <Field label={t('phase1.step3.technical.gtcType')}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([
                          { value: 'IND',   label: t('phase1.step3.technical.industrielEn'),  desc: t('phase1.step3.technical.industrielEnDesc') },
                          { value: 'STT',   label: t('phase1.step3.technical.tertiaireEn'),   desc: t('phase1.step3.technical.tertiaireEnDesc') },
                          { value: 'MIXTE', label: t('phase1.step3.technical.mixte'),   desc: t('phase1.step3.technical.mixteEnDesc') },
                        ] as const).map(opt => (
                          <button key={opt.value} type="button" onClick={() => setSousTypeTechnique(opt.value)}
                            style={{
                              flex: 1, padding: '10px 6px', border: `2px solid ${sousTypeTechnique === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                              borderRadius: 10, background: sousTypeTechnique === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: sousTypeTechnique === opt.value ? 'var(--green2)' : 'var(--text2)',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            }}>
                            <span>{opt.label}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </Field>
                    {sousTypeTechnique && (
                      <Field label={t('phase1.step3.technical.q14')}>
                        <CheckboxGroup
                          options={(
                            sousTypeTechnique === 'MIXTE' ? [{ value: 'STT', label: 'STT' }, { value: 'IND', label: 'IND' }]
                            : [{ value: sousTypeTechnique, label: sousTypeTechnique }]
                          )}
                          values={form.filieresTechniques}
                          onChange={v => setForm(f => ({ ...f, filieresTechniques: v }))}
                        />
                      </Field>
                    )}
                  </div>
                )}

                {/* CETIC — toggle CETIF + filières spécifiques */}
                {template.code === 'CETIC' && (
                  <div>
                    <Field label={t('phase1.step3.technical.ceticType')}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {[
                          { val: false, label: t('phase1.step3.technical.ceticGeneral'),            desc: t('phase1.step3.technical.ceticGeneralDesc') },
                          { val: true,  label: t('phase1.step3.technical.ceticCETIF'), desc: t('phase1.step3.technical.ceticCETIFDesc') },
                        ].map((opt, i) => (
                          <button key={i} type="button" onClick={() => {
                            setCetifMode(opt.val)
                            // Pont vers le champ admissionType réel — le toggle CETIF existant
                            // ne stockait jusqu'ici qu'une liste de filières différente, jamais
                            // une restriction d'admission structurée. Voir Phase 0 du chantier
                            // GTC_EN/GTC_GTHS_EN (13/07/2026).
                            setForm(f => ({ ...f, admissionType: opt.val ? 'FILLES' : 'MIXTE' }))
                          }}
                            style={{
                              flex: 1, padding: '10px 6px', border: `2px solid ${cetifMode === opt.val ? 'var(--green)' : 'var(--border2)'}`,
                              borderRadius: 10, background: cetifMode === opt.val ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: cetifMode === opt.val ? 'var(--green2)' : 'var(--text2)',
                              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                            }}>
                            <span>{opt.label}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </Field>
                    {cetifMode ? (
                      <Field label={t('phase1.step3.technical.ceticFilieres')}>
                        <CheckboxGroup
                          options={CETIF_FILIERES_OPTIONS.map(v => ({ value: v, label: t('phase1.ceticFilieres.' + v) }))}
                          values={form.filieresTechniques}
                          onChange={v => setForm(f => ({ ...f, filieresTechniques: v }))}
                        />
                      </Field>
                    ) : (
                      <Field label={t('phase1.step3.technical.q14Tech')}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                              {t('phase1.step3.technical.optionsOfficielles')}
                      </div>
                      <CheckboxGroup
                        options={FILIERES_TECHNIQUES_OFF.map(v => ({ value: v, label: v }))}
                        values={form.filieresTechniques}
                        onChange={v => setForm(f => ({ ...f, filieresTechniques: v }))}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                        {t('phase1.step3.technical.optionsTerrain')}
                      </div>
                      <CheckboxGroup
                        options={FILIERES_TECHNIQUES_TER.map(v => ({ value: v, label: v }))}
                        values={form.filieresTechniques}
                        onChange={v => setForm(f => ({ ...f, filieresTechniques: v }))}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>{t('phase1.step3.technical.autres')}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input className="edu-field" value={customTech}
                          style={{ ...INPUT, padding: '7px 12px', fontSize: 14, maxWidth: 250 }}
                          onChange={e => setCustomTech(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && customTech.trim() && !form.filieresTechniques.includes(customTech.trim())) {
                              setForm(f => ({ ...f, filieresTechniques: [...f.filieresTechniques, customTech.trim()] }))
                              setCustomTech('')
                            }
                          }}
                          placeholder={t('phase1.step3.technical.placeholder')} />
                        <button type="button" onClick={() => {
                          if (customTech.trim() && !form.filieresTechniques.includes(customTech.trim())) {
                            setForm(f => ({ ...f, filieresTechniques: [...f.filieresTechniques, customTech.trim()] }))
                            setCustomTech('')
                          }
                        }}
                          style={{
                            padding: '7px 12px', background: 'var(--green)', color: 'white', border: 'none',
                            borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                          }}>
                          {t('phase1.step3.technical.add')}
                        </button>
                      </div>
                    </div>
                  </div>
                      </Field>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── GROUPE D — Primaire ── */}
            {template && (template.isPrimaire || template.isComplexe) && (
              <div style={{ marginTop: 8, marginBottom: 8 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: 'var(--text)',
                  padding: '8px 0', borderBottom: '2px solid #d4a843', marginBottom: 14,
                }}>
                  {t('phase1.step3.primary.sectionTitle')}
                </div>

                {/* MATERNELLE_FR — formulaire simplifié (aussi affiché pour COMPLEXE_SCOLAIRE) */}
                {(template.code === 'MATERNELLE_FR' || template.isComplexe) && (
                  <div>
                    <Field label={t('phase1.step3.primary.maternelleSections')}>
                      <CheckboxGroup
                        options={['Petite section','Moyenne section','Grande section'].map(v => ({ value: v, label: v }))}
                        values={maternelleSections}
                        onChange={setMaternelleSections}
                      />
                    </Field>
                    <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>
                      {t('phase1.step3.primary.maternelleHint')}
                    </div>
                  </div>
                )}

                {/* NURSERY_EN — formulaire simplifié */}
                {template.code === 'NURSERY_EN' && (
                  <div>
                    <Field label={t('phase1.step3.primary.nurseryLevels')}>
                      <CheckboxGroup
                        options={['PreNursery','Nursery 1','Nursery 2'].map(v => ({ value: v, label: v }))}
                        values={nurseryLevels}
                        onChange={setNurseryLevels}
                      />
                    </Field>
                    <div style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 600, marginTop: 4 }}>
                      {t('phase1.step3.primary.nurseryHint')}
                    </div>
                  </div>
                )}

                {/* PRIMARY_BILINGUAL — double bloc FR + EN */}
                {template.code === 'PRIMARY_BILINGUAL' && (
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>{t('phase1.step3.primary.frSection')}</div>
                    <Field label={t('phase1.step3.primary.levelsFR')}>
                      <CheckboxGroup
                        options={NIVEAUX_PRIMAIRE_FR.map(v => ({ value: v, label: v }))}
                        values={form.niveauxPrimaire}
                        onChange={v => setForm(f => ({
                          ...f,
                          niveauxPrimaire: v,
                          classesParNiveauPrimaire: v.reduce((acc, lvl) => ({
                            ...acc,
                            [lvl]: f.classesParNiveauPrimaire[lvl] ?? 2,
                          }), {} as Record<string, number>),
                        }))}
                      />
                    </Field>
                    <Field label={t('phase1.step3.primary.evalFR')}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([
                          { value: 'APC_300', label: t('phase1.step3.primary.apc300') },
                          { value: 'NOTES_20', label: t('phase1.step3.primary.notes20') },
                        ] as const).map(opt => (
                          <button key={opt.value} type="button" onClick={() => setEvalSystemPrimaire(opt.value)}
                            style={{
                              flex: 1, padding: '10px 8px', border: `2px solid ${evalSystemPrimaire === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                              borderRadius: 10, background: evalSystemPrimaire === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: evalSystemPrimaire === opt.value ? 'var(--green2)' : 'var(--text2)',
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label={t('phase1.step3.primary.appelFR')}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([
                          { value: 'TWICE', label: `${t('phase1.step3.primary.twice')} (${t('phase1.step3.primary.twiceDesc')})` },
                          { value: 'ONCE', label: t('phase1.step3.primary.once') },
                        ] as const).map(opt => (
                          <button key={opt.value} type="button" onClick={() => setAppelFrequency(opt.value)}
                            style={{
                              flex: 1, padding: '10px 8px', border: `2px solid ${appelFrequency === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                              borderRadius: 10, background: appelFrequency === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
                              color: appelFrequency === opt.value ? 'var(--green2)' : 'var(--text2)',
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <div style={{ borderTop: '1.5px solid var(--border)', margin: '14px 0' }} />
                    <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--text)', marginBottom: 10 }}>{t('phase1.step3.primary.enSection')}</div>
                    <Field label={t('phase1.step3.primary.levelsEN')}>
                      <CheckboxGroup
                        options={NIVEAUX_PRIMAIRE_EN.map(v => ({ value: v, label: v }))}
                        values={bilingualEnLevels}
                        onChange={setBilingualEnLevels}
                      />
                    </Field>
                    <Field label={t('phase1.step3.primary.reportCardFreq')}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {([
                          { value: 'MONTHLY', label: t('phase1.step3.primary.monthly') },
                          { value: 'TRIMESTRIAL', label: t('phase1.step3.primary.perTerm') },
                        ] as const).map(opt => (
                          <button key={opt.value} type="button" onClick={() => setBulletinFrequency(opt.value)}
                            style={{
                              flex: 1, padding: '10px 8px', border: `2px solid ${bulletinFrequency === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                              borderRadius: 10, background: bulletinFrequency === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                              cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                              color: bulletinFrequency === opt.value ? 'var(--green2)' : 'var(--text2)',
                            }}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </Field>
                  </div>
                )}

                {/* Q15/Q16 — formulaire standard primaire (PRIMAIRE_FR, PRIMARY_EN) */}
                {template.code !== 'MATERNELLE_FR' && template.code !== 'NURSERY_EN' && template.code !== 'PRIMARY_BILINGUAL' && (
                  <div>
                    {/* PRIMAIRE_FR — évaluation + appel */}
                    {template.code === 'PRIMAIRE_FR' && (
                      <div style={{ marginBottom: 8 }}>
                        <Field label={t('phase1.step3.primary.evalSystem')}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {([
                              { value: 'APC_300', label: t('phase1.step3.primary.apc300'), desc: t('phase1.step3.primary.apc300Desc') },
                              { value: 'NOTES_20', label: t('phase1.step3.primary.notes20'), desc: t('phase1.step3.primary.notes20Desc') },
                            ] as const).map(opt => (
                              <button key={opt.value} type="button" onClick={() => setEvalSystemPrimaire(opt.value)}
                                style={{
                                  flex: 1, padding: '10px 8px', border: `2px solid ${evalSystemPrimaire === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                                  borderRadius: 10, background: evalSystemPrimaire === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                                  color: evalSystemPrimaire === opt.value ? 'var(--green2)' : 'var(--text2)',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                                }}>
                                <span>{opt.label}</span>
                                <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{opt.desc}</span>
                              </button>
                            ))}
                          </div>
                        </Field>
                        <Field label={t('phase1.step3.primary.appelFrequency')}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            {([
                              { value: 'TWICE', label: t('phase1.step3.primary.twice'), desc: t('phase1.step3.primary.twiceDesc') },
                              { value: 'ONCE', label: t('phase1.step3.primary.once'), desc: '' },
                            ] as const).map(opt => (
                              <button key={opt.value} type="button" onClick={() => setAppelFrequency(opt.value)}
                                style={{
                                  flex: 1, padding: '10px 8px', border: `2px solid ${appelFrequency === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                                  borderRadius: 10, background: appelFrequency === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                                  cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                                  color: appelFrequency === opt.value ? 'var(--green2)' : 'var(--text2)',
                                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                                }}>
                                <span>{opt.label}</span>
                                {opt.desc && <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>{opt.desc}</span>}
                              </button>
                            ))}
                          </div>
                        </Field>
                      </div>
                    )}

                    {/* PRIMARY_EN — bulletin frequency */}
                    {template.code === 'PRIMARY_EN' && (
                      <Field label={t('phase1.step3.primary.reportCardFreq')}>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {([
                            { value: 'MONTHLY', label: t('phase1.step3.primary.monthly') },
                            { value: 'TRIMESTRIAL', label: t('phase1.step3.primary.perTerm') },
                          ] as const).map(opt => (
                            <button key={opt.value} type="button" onClick={() => setBulletinFrequency(opt.value)}
                              style={{
                                flex: 1, padding: '10px 8px', border: `2px solid ${bulletinFrequency === opt.value ? 'var(--green)' : 'var(--border2)'}`,
                                borderRadius: 10, background: bulletinFrequency === opt.value ? 'rgba(5,150,105,0.07)' : 'white',
                                cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                                color: bulletinFrequency === opt.value ? 'var(--green2)' : 'var(--text2)',
                              }}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </Field>
                    )}

                    {/* Q15 — Niveaux primaire */}
                    <Field label={t('phase1.step3.primary.q15')}>
                      <CheckboxGroup
                        options={
                          form.subsystem === 'ANGLOPHONE'
                            ? NIVEAUX_PRIMAIRE_EN.map(v => ({ value: v, label: v }))
                            : NIVEAUX_PRIMAIRE_FR.map(v => ({ value: v, label: v }))
                        }
                        values={form.niveauxPrimaire}
                        onChange={v => setForm(f => ({
                          ...f,
                          niveauxPrimaire: v,
                          classesParNiveauPrimaire: v.reduce((acc, lvl) => ({
                            ...acc,
                            [lvl]: f.classesParNiveauPrimaire[lvl] ?? 2,
                          }), {} as Record<string, number>),
                        }))}
                      />
                    </Field>

                    {/* Q16 — Classes par niveau primaire */}
                    {form.niveauxPrimaire.length > 0 && (
                      <Field label={t('phase1.step3.primary.q16')}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {form.niveauxPrimaire.map(niveau => (
                            <div key={niveau} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={{ width: 60, fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{niveau}</div>
                              <StepperBtns
                                value={form.classesParNiveauPrimaire[niveau] ?? 1}
                                onChange={v => setNiveauPrimaireCount(niveau, v)}
                                max={4}
                              />
                            </div>
                          ))}
                        </div>
                      </Field>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ── APERÇU EN TEMPS RÉEL ── */}
            {template && (
              <div style={{ marginTop: 16, marginBottom: 12 }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: 'var(--text)',
                  padding: '8px 0', borderBottom: '2px solid var(--border2)', marginBottom: 14,
                }}>
                  {t('phase1.step3.preview.title')}
                </div>

                <div style={{
                  background: 'var(--bg2)', border: '1.5px solid var(--border)',
                  borderRadius: 12, padding: '14px 16px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>
                    <School size={16} strokeWidth={2} /> {templateDisplayName(template, currentLang === 'en' ? 'en' : 'fr')}
                  </div>

                  {previewLoading && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
                      <div style={{ width: 14, height: 14, border: '2px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }} />
                      {t('phase1.loading.computing')}
                    </div>
                  )}

                  {!previewLoading && previewData && (
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--green2)', marginBottom: 8 }}>
                        {previewData.totalClasses} {t('phase1.step3.preview.totalClasses')}
                      </div>

                      {/* Group classes by cycle */}
                      {FIRST_CYCLE_LEVELS.filter(lvl =>
                        previewData.classes.some(c => c.level === lvl)
                      ).length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                            {t('phase1.step3.preview.firstCycleGroup')} {previewData.classes.filter(c => FIRST_CYCLE_LEVELS.includes(c.level)).length} classes :
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, fontWeight: 600 }}>
                            {(() => {
                              return FIRST_CYCLE_LEVELS.filter(lvl => previewData.classes.some(c => c.level === lvl))
                                .map(lvl => ({
                                  lvl,
                                  names: previewData.classes.filter(c => c.level === lvl).map(c => c.name),
                                }))
                                .map(g => `${g.lvl} ${g.names.map(n => n.replace(g.lvl + ' ', '')).join(' · ')}`)
                                .join('\n')
                            })()}
                          </div>
                        </div>
                      )}

                      {SECOND_CYCLE_LEVELS.filter(lvl =>
                        previewData.classes.some(c => c.level === lvl)
                      ).length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }}>
                            {t('phase1.step3.preview.secondCycleGroup')} {previewData.classes.filter(c => SECOND_CYCLE_LEVELS.includes(c.level)).length} classes :
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, fontWeight: 600 }}>
                            {(() => {
                              return SECOND_CYCLE_LEVELS.filter(lvl => previewData.classes.some(c => c.level === lvl))
                                .map(lvl => ({
                                  lvl,
                                  names: previewData.classes.filter(c => c.level === lvl).map(c => c.name),
                                }))
                                .map(g => `${g.lvl} ${g.names.map(n => n.replace(g.lvl + ' ', '')).join(' · ')}`)
                                .join('\n')
                            })()}
                          </div>
                        </div>
                      )}

                      {previewData.subjects.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
                          {t('phase1.step3.preview.subjects')} {previewData.subjects.length} {t('phase1.step3.preview.withCoefficients')}
                        </div>
                      )}
                    </div>
                  )}

                  {!previewLoading && !previewData && (
                    <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>
                      {t('phase1.step3.preview.placeholder')}
                    </div>
                  )}

                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
                      {t('phase1.step3.preview.yearAutoConfig')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
                      {t('phase1.step3.preview.minesecConfig')}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                      {t('phase1.step3.preview.modifiableLater')}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <SubmitBtn onClick={goNext} disabled={!template} loadingText={t('phase1.loading.processing')}>
              {t('phase1.step3.button')}
            </SubmitBtn>
          </div>
        )}

        {/* ── STEP 4 — Confirmation ──────────────── */}
        {step === 4 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <button type="button" onClick={() => { setStep(3); setSubmitError('') }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 700, color: 'var(--text3)', cursor: 'pointer', background: 'none', border: 'none', fontFamily: 'inherit', marginBottom: 14, padding: 0 }}>
              {t('phase1.step4.back')}
            </button>

            {/* Établissement summary */}
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{t('phase1.step4.establishmentSection')}</div>
              {form.logoBase64 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, padding: '8px 0', borderBottom: '1px solid var(--bg2)' }}>
                  <img src={form.logoBase64} alt="Logo" style={{ width: 44, height: 44, borderRadius: 10, objectFit: 'cover', border: '1.5px solid var(--border)' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)' }}>{t('phase1.step1.logo.uploaded')}</span>
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                {[
                  { labelKey: 'phase1.step4.fields.name', val: form.nom },
                  { labelKey: 'phase1.step4.fields.subdomain', val: `zekoulabia.cm/${form.subdomain}` },
                  { labelKey: 'phase1.step4.fields.template', val: template ? templateDisplayName(template, currentLang === 'en' ? 'en' : 'fr') : '—' },
                  { labelKey: 'phase1.step4.fields.subsystem', val: subsystemOptions.find(o => o.value === form.subsystem)?.label ?? form.subsystem },
                  { labelKey: 'phase1.step4.fields.education', val: form.educationType ? t(`phase1.step1.educationType.options.${form.educationType}.label`) : '—' },
                  { labelKey: 'phase1.step4.fields.ownership', val: ownershipOptions.find(o => o.value === form.ownership)?.label ?? form.ownership },
                  { labelKey: 'phase1.step4.fields.city', val: form.ville || '—' },
                  { labelKey: 'phase1.step4.fields.region', val: form.region || '—' },
                ].map(({ labelKey, val }) => (
                  <div key={labelKey}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t(labelKey)}</div>
                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700, wordBreak: 'break-all' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Admin summary */}
            <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>{t('phase1.step4.adminSection')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                {[
                  { labelKey: 'phase1.step4.fields.firstName', val: form.adminPrenom },
                  { labelKey: 'phase1.step4.fields.lastName', val: form.adminNom },
                  { labelKey: 'phase1.step4.fields.email', val: form.adminEmail },
                  { labelKey: 'phase1.step4.fields.password', val: t('phase1.step4.fields.passwordMasked') },
                ].map(({ labelKey, val }) => (
                  <div key={labelKey}>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t(labelKey)}</div>
                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700, wordBreak: 'break-all' }}>{val}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Structure summary */}
            {template && (
              <div style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 12, padding: '14px 16px', marginBottom: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>
                  {t('phase1.step4.configSection')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px' }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.template')}</div>
                    <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{templateDisplayName(template, currentLang === 'en' ? 'en' : 'fr')}</div>
                  </div>
                  {hasMaternelleData({ maternelleSections, nurseryLevels }) && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.maternelle')}</div>
                      <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{[...maternelleSections, ...nurseryLevels].join(' · ')}</div>
                    </div>
                  )}
                  {hasPrimaireData(form) && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.primary')}</div>
                      <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{form.niveauxPrimaire.join(' · ')} ({Object.values(form.classesParNiveauPrimaire).reduce((total, count) => total + count, 0)} {t('phase1.step3.preview.totalClasses')})</div>
                    </div>
                  )}
                  {hasPremierCycleData(form) && (
                    <>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.firstCycle')}</div>
                        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
                          {form.niveaux1erCycle.join(' · ')} ({Object.values(form.classesParNiveau).reduce((a, b) => a + b, 0) || 0} {t('phase1.step3.preview.totalClasses')})
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.convention')}</div>
                        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
                          {conventionOptions.find(o => o.value === form.conventionNommage)?.label ?? form.conventionNommage}
                        </div>
                      </div>
                      {form.lv2Debut !== 'NON_APPLICABLE' && form.lv2Disponibles.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.lv2')}</div>
                          <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
                            {form.lv2Disponibles.join(' · ')} ({t('phase1.step4.fields.fromLevel')} {form.lv2Debut})
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {hasDeuxiemeCycleData(form) && (
                    <>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.secondCycle')}</div>
                        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
                          {form.niveaux2eCycle.join(' · ')}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.filieres')}</div>
                        <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>
                          {form.filieres.length > 0 ? form.filieres.join(' · ') : '—'}
                        </div>
                      </div>
                      {form.a4Languages.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.a4Languages')}</div>
                          <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{form.a4Languages.join(' · ')}</div>
                        </div>
                      )}
                    </>
                  )}
                  {hasTechniqueData({ filieresTechniques: form.filieresTechniques, sarMetiers, cfmFilieres }) && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.techFilieres')}</div>
                      <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{[...form.filieresTechniques, ...sarMetiers, ...cfmFilieres].join(' · ')}</div>
                    </div>
                  )}
                  {(enStreamStartLevel || enGradingSystem || bilingualEnLevels.length > 0 || bilingualEnFilieres.length > 0) && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.streamsEn')}</div>
                      <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{[enStreamStartLevel, enGradingSystem, ...bilingualEnLevels, ...bilingualEnFilieres].filter(value => value.length > 0).join(' · ')}</div>
                    </div>
                  )}
                  {(hasPEBSFrancophone || hasPEBSAnglophone) && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.pebsFr')} / {t('phase1.step4.fields.pebsEn')}</div>
                      <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{[hasPEBSFrancophone ? t('phase1.step4.fields.pebsFr') : '', hasPEBSAnglophone ? t('phase1.step4.fields.pebsEn') : ''].filter(value => value.length > 0).join(' · ')}</div>
                    </div>
                  )}
                  {previewData && (
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase' }}>{t('phase1.step4.fields.totalClasses')}</div>
                      <div style={{ fontSize: 14, color: 'var(--text)', fontWeight: 700 }}>{previewData.totalClasses}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <Alert msg={t('phase1.step4.info')} type="info" />

            {submitError && (
              <div ref={errorRef}>
                <Alert msg={submitError} type="error" />
              </div>
            )}

            <SubmitBtn loading={submitLoading} onClick={handleSubmit} loadingText={t('phase1.loading.processing')}>
              {t('phase1.buttons.step4Submit')}
            </SubmitBtn>
          </div>
        )}
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        * { box-sizing: border-box; }
        .edu-step:not(:last-child)::after {
          content: '';
          position: absolute; top: 13px; left: calc(50% + 12px);
          width: calc(100% - 24px); height: 2px;
          background: var(--border2); transition: background 0.4s;
        }
        .edu-step.s-done:not(:last-child)::after,
        .edu-step.s-active:not(:last-child)::after { background: var(--green2); }
        .edu-field:focus { border-color: var(--green) !important; background: #f0ece6 !important; box-shadow: 0 0 0 3px rgba(142,42,58,0.08); }
        @keyframes edu-spin { to { transform: rotate(360deg); } }
        @keyframes edu-fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes edu-fadeDown { from { opacity:0; transform:translateY(-12px); } to { opacity:1; transform:translateY(0); } }
        .edu-mobile-lang { display: none; }
        @media (max-width: 768px) {
          .edu-left-panel { display: none !important; }
          /* Pas besoin de forcer une largeur ici : flex:1 suffit déjà une fois le panneau
             gauche retiré du flux (display:none) — un ancien "width: 100vw !important" ici
             provoquait un débordement horizontal (100vw inclut la barre de défilement). */
          .edu-mobile-lang { display: flex !important; }
        }
      `}</style>

      <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', fontFamily: 'var(--font-nunito),Nunito,sans-serif' }}>

        {LeftPanel}

        {/* ── Right panel ── */}
        <div className="edu-right-panel" style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', background: 'var(--bg)', overflowY: 'auto', overflowX: 'hidden', position: 'relative', padding: '32px 24px' }}>
          <div style={{ position: 'absolute', top: -100, right: -100, width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle,rgba(34,197,94,0.05) 0%,transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ width: '100%', maxWidth: 520, position: 'relative', zIndex: 1 }}>
            {/* Bascule de langue — visible uniquement sur mobile (le panneau gauche, qui porte
                le toggle sur desktop, est masqué sous 768px) */}
            <div className="edu-mobile-lang" style={{ justifyContent: 'flex-end', gap: 3, marginBottom: 16 }}>
              {(['fr', 'en'] as const).map((l) => {
                const active = currentLang === l
                return (
                  <button key={l} type="button" onClick={() => { if (!active) changeLanguage(l) }} aria-pressed={active}
                    style={{ padding: '5px 13px', borderRadius: 8, border: `1.5px solid ${active ? 'var(--green)' : 'var(--border2)'}`, cursor: active ? 'default' : 'pointer', fontFamily: 'inherit', fontWeight: 800, fontSize: 12.5, letterSpacing: '0.3px', background: active ? 'var(--green)' : 'var(--surface)', color: active ? 'white' : 'var(--text2)', transition: 'background 0.15s, color 0.15s' }}>
                    {l === 'fr' ? 'FR' : 'EN'}
                  </button>
                )
              })}
            </div>
            {content}
          </div>
        </div>
      </div>
    </>
  )
}
