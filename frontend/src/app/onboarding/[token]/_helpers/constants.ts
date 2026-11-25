import { Languages, Landmark, School, Church } from 'lucide-react'
import type { FormData, Step } from './types'

export const REGIONS = ['Adamaoua', 'Centre', 'Est', 'Extrême-Nord', 'Littoral', 'Nord', 'Nord-Ouest', 'Ouest', 'Sud', 'Sud-Ouest']

export const SUBSYSTEM_KEYS = [
  { value: 'FRANCOPHONE', key: 'phase1.step1.subsystem.options.FRANCOPHONE.label', icon: Languages },
  { value: 'ANGLOPHONE', key: 'phase1.step1.subsystem.options.ANGLOPHONE.label', icon: Languages },
  { value: 'BILINGUAL', key: 'phase1.step1.subsystem.options.BILINGUAL.label', icon: Languages },
]

export const OWNERSHIP_KEYS = [
  { value: 'PUBLIC', key: 'phase1.step1.ownership.options.PUBLIC.label', icon: Landmark },
  { value: 'PRIVATE_SECULAR', key: 'phase1.step1.ownership.options.PRIVATE_SECULAR.label', icon: School },
  { value: 'PRIVATE_FAITH', key: 'phase1.step1.ownership.options.PRIVATE_FAITH.label', icon: Church },
]

export const NIVEAUX_1ER_CYCLE_FR = ['6e', '5e', '4e', '3e']
export const NIVEAUX_1ER_CYCLE_CAP = ['CAP1', 'CAP2', 'CAP3', 'CAP4']
export const NIVEAUX_1ER_CYCLE_EN = ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5']
export const NIVEAUX_1ER_CYCLE_EN_LOWER = ['Form 1', 'Form 2', 'Form 3']
export const NIVEAUX_2E_CYCLE_FR = ['2nde', '1ère', 'Tle']
export const NIVEAUX_2E_CYCLE_EN = ['Lower Sixth', 'Upper Sixth']

export const FIRST_CYCLE_LEVELS = [...NIVEAUX_1ER_CYCLE_FR, ...NIVEAUX_1ER_CYCLE_CAP, ...NIVEAUX_1ER_CYCLE_EN]
export const SECOND_CYCLE_LEVELS = [...NIVEAUX_2E_CYCLE_FR, ...NIVEAUX_2E_CYCLE_EN]

export const FILIERES_LITT = [
  'A4 — Langues Vivantes',
  'A1 — Littéraire LV1 renforcée',
  'A2 — Littéraire LV2 renforcée',
  'A3 — Littéraire LV3 renforcée',
  'A5 — Philosophie renforcée',
  'SH — Sciences Humaines',
  'AC — Arts et Cinématographiques (rare)',
]
export const FILIERES_SCIENT = ['C — Mathématiques-Physique', 'D — Mathématiques-SVT', "TI — Technologies de l'Information", 'E — (rare)']
export const FILIERES_TECH = ['F · G · H (technique)']

export const FILIERES_EN_ARTS = ['A1 — Literature', 'A2 — History', 'A3 — Geography', 'A4 — Languages']
export const FILIERES_EN_SCIENCES = ['S1 — Maths', 'S2 — Physics', 'S3 — Biology', 'S4 — Chemistry']

export const NIVEAUX_EN_FULL = ['Form 1', 'Form 2', 'Form 3', 'Form 4', 'Form 5', 'Lower Sixth', 'Upper Sixth']

export const FILIERES_TECHNIQUES_OFF = ['F1', 'F2', 'F3', 'G1', 'G2', 'G3', 'INFOR', 'HOTEL', 'COUTURE', 'AGRIC']
export const FILIERES_TECHNIQUES_TER = ['MAEL', 'TMI', 'ECS', 'ESF', 'IH']

export const NIVEAUX_PRIMAIRE_FR = ['SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2']
export const NIVEAUX_PRIMAIRE_EN = ['Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6']

export const LV2_OPTIONS = ['Espagnol', 'Allemand', 'Chinois', 'Arabe', 'Latin', 'Italien']

export const CONVENTION_KEYS = [
  { value: 'LETTRES', key: 'phase1.step3.firstCycle.naming.LETTRES.label', descKey: 'phase1.step3.firstCycle.naming.LETTRES.desc' },
  { value: 'CHIFFRES', key: 'phase1.step3.firstCycle.naming.CHIFFRES.label', descKey: 'phase1.step3.firstCycle.naming.CHIFFRES.desc' },
  { value: 'MIXTE', key: 'phase1.step3.firstCycle.naming.MIXTE.label', descKey: 'phase1.step3.firstCycle.naming.MIXTE.desc' },
]

export const SAR_METIERS_OPTIONS = ['Maçonnerie', 'Menuiserie', 'Couture', 'Cuisine', 'Agriculture', 'Mécanique']
export const CFM_FILIERES_OPTIONS = ['Agro-alimentaire', 'Artisanat', 'BTP', 'Numérique']
export const CETIF_FILIERES_OPTIONS = ['ESF', 'Couture', 'Hôtellerie', 'Cuisine']

export const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
export const MAX_STEPPER = 6

export const STEPPER_LABELS: { n: Step; key: string }[] = [
  { n: 1, key: 'phase1.stepper.labels.establishment' },
  { n: 2, key: 'phase1.stepper.labels.admin' },
  { n: 3, key: 'phase1.stepper.labels.configuration' },
  { n: 4, key: 'phase1.stepper.labels.confirmation' },
]

export function toSlug(v: string) {
  return v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

export function previewClassNames(level: string, count: number, convention: string): string[] {
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

export const INITIAL_FORM: FormData = {
  nom: '',
  subdomain: '',
  subsystem: 'FRANCOPHONE',
  educationType: 'GENERAL',
  ownership: 'PRIVATE_SECULAR',
  admissionType: 'MIXTE',
  ville: '',
  region: '',
  telephone: '',
  adresse: '',
  logoBase64: '',
  adminPrenom: '',
  adminNom: '',
  adminEmail: '',
  password: '',
  confirmPassword: '',
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
}
