import type React from 'react'

export type OrientationView = 'dashboard' | 'fiche' | 'checkpoints'
export type OrientationTab = 'entretiens' | 'tests' | 'serie' | 'suivis'
export type CheckpointTypeValue = 'FIN_TROISIEME' | 'FIN_SECONDE_C'

export interface OrientationStats {
  fichesOuvertes: number
  elevesArisqueEleve: number
  elevesArisqueCritique: number
  entretiensThisMois: number
  recommandationsEnAttente: number
  repartitionRisque: Record<string, number>
}

export interface FicheListItem {
  id: string
  status: string
  riskLevel: string
  mainConcern: string | null
  createdAt: string
  updatedAt: string
  student: {
    id: string
    firstName: string
    lastName: string
    studentProfile?: { class?: { name: string } | null } | null
  }
  _count: { entretiens: number; tests: number; suivis: number }
}

export interface Entretien {
  id: string
  ficheOrientationId: string
  date: string
  type: string
  motif: string
  notes: string | null
  recommendations: string | null
  nextActions: string | null
  parentNotified: boolean
  followUpDate: string | null
  status: string
  createdAt: string
}

export interface TestAptitude {
  id: string
  ficheOrientationId: string
  type: string
  datePassage: string
  resultats: string
  interpretation: string | null
  scoreGlobal: number | null
  createdAt: string
}

export interface SuggestedTrack {
  track: string
  score: number
  justification: string
}

export interface Recommandation {
  id: string
  ficheOrientationId: string
  studentId: string
  serieActuelle: string
  serieRecommandee: string
  justification: string
  parentNotified: boolean
  adminValidated: boolean
  status: string
  createdAt: string
  checkpointType: string | null
  suggestedTracks: SuggestedTrack[] | null
  confidenceLevel: string | null
  dataDepthMonths: number | null
  responseDeadline: string | null
  studentChosenTrack: string | null
  finalizedAt: string | null
  finalTrack: string | null
}

export interface EleveAOrienter {
  studentId: string
  firstName: string
  lastName: string
  className: string
  hasRecommendation: boolean
  recommendationStatus: string | null
}

export interface CheckpointConfig {
  type: string
  possibleTracks: string[]
  relevantSubjects: unknown
  psychotechnicalTestRequired: boolean
  windowStartMonth: number
  windowStartDay: number
  windowEndMonth: number
  windowEndDay: number
  responseDeadlineDays: number
}

export interface Suivi {
  id: string
  ficheOrientationId: string
  date: string
  riskLevel: string
  mainConcern: string
  interventions: string | null
  prochainRdv: string | null
  notes: string | null
}

export interface FicheDetail extends FicheListItem {
  schoolId: string
  academicYearId: string
  conseillerId: string
  entretiens: Entretien[]
  tests: TestAptitude[]
  recommandation: Recommandation | null
  suivis: Suivi[]
}

export interface StudentResult {
  id: string
  firstName: string
  lastName: string
}

export interface AcademicYear {
  id: string
  label: string
}

export interface NewFicheFormState {
  studentSearch: string
  studentResults: StudentResult[]
  selectedStudent: StudentResult | null
  mainConcern: string
  loading: boolean
  error: string
}

export interface EntretienFormState {
  date: string
  type: string
  motif: string
  notes: string
  recommendations: string
  nextActions: string
  parentNotified: boolean
  followUpDate: string
  loading: boolean
  error: string
}

export interface TestFormState {
  type: string
  datePassage: string
  resultats: string
  interpretation: string
  scoreGlobal: string
  checkpointType: string
  scientificAptitude: string
  literaryAptitude: string
  technicalAptitude: string
  loading: boolean
  error: string
}

export interface SuiviFormState {
  riskLevel: string
  mainConcern: string
  interventions: string
  prochainRdv: string
  notes: string
  loading: boolean
  error: string
}

export interface EditEntretienOrig {
  notes: string
  recommendations: string
  nextActions: string
  parentNotified: boolean
  followUpDate: string
  status: string
}

export interface EditEntretienFormState extends EditEntretienOrig {
  entretienId: string
  loading: boolean
  error: string
}

export interface RecoFormState {
  serieActuelle: string
  serieRecommandee: string
  justification: string
  loading: boolean
  error: string
}

export interface CheckpointConfigFormState {
  psychotechnicalTestRequired: boolean
  windowStartMonth: number
  windowStartDay: number
  windowEndMonth: number
  windowEndDay: number
  responseDeadlineDays: number
  loading: boolean
  error: string
}

export const RISK_STYLE: Record<string, { bg: string; color: string }> = {
  FAIBLE:   { bg: 'var(--green-light)', color: 'var(--green)' },
  MOYEN:    { bg: 'var(--amber-light)', color: 'var(--amber)' },
  ELEVE:    { bg: 'var(--red-light)', color: 'var(--red)' },
  CRITIQUE: { bg: 'var(--red-light)', color: 'var(--red)' },
}

export const RISK_LABEL_KEY: Record<string, string> = {
  FAIBLE: 'riskBadgeFaible',
  MOYEN: 'riskBadgeMoyen',
  ELEVE: 'riskBadgeEleve',
  CRITIQUE: 'riskBadgeCritique',
}

export const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  OUVERTE:    { bg: 'var(--green-light)', color: 'var(--green)' },
  EN_COURS:   { bg: 'var(--blue-light)', color: 'var(--blue)' },
  CLOSE:      { bg: 'var(--bg2)', color: 'var(--text3)' },
  TRANSFEREE: { bg: 'var(--purple-light)', color: 'var(--purple)' },
}

export const STATUS_LABEL_KEY: Record<string, string> = {
  OUVERTE: 'statusOuverte',
  EN_COURS: 'statusEnCours',
  CLOSE: 'statusClose',
  TRANSFEREE: 'statusTransferee',
}

export const MOTIF_OPTIONS = [
  { value: 'ORIENTATION_GENERALE',  labelKey: 'motifOrientationGenerale' },
  { value: 'DIFFICULTE_SCOLAIRE',   labelKey: 'motifDifficulteScolaire' },
  { value: 'CHOIX_FILIERE_BAC',     labelKey: 'motifChoixFiliere' },
  { value: 'PROJET_PROFESSIONNEL',  labelKey: 'motifProjetPro' },
  { value: 'PROBLEME_COMPORTEMENT', labelKey: 'motifComportement' },
  { value: 'DEMANDE_ELEVE',         labelKey: 'motifDemandeEleve' },
  { value: 'DEMANDE_PARENT',        labelKey: 'motifDemandeParent' },
  { value: 'DEMANDE_ENSEIGNANT',    labelKey: 'motifDemandeEnseignant' },
]

export const TYPE_ENTRETIEN_OPTIONS = [
  { value: 'INDIVIDUEL',  labelKey: 'typeEntretienIndividuel' },
  { value: 'GROUPE',      labelKey: 'typeEntretienGroupe' },
  { value: 'AVEC_PARENT', labelKey: 'typeEntretienAvecParent' },
]

export const TYPE_TEST_OPTIONS = [
  { value: 'COGNITIF',                labelKey: 'typeTestCognitif' },
  { value: 'INTERETS_PROFESSIONNELS', labelKey: 'typeTestInterets' },
  { value: 'PERSONNALITE',            labelKey: 'typeTestPersonnalite' },
  { value: 'PSYCHOTECHNIQUE',         labelKey: 'typeTestPsychotechnique' },
]

export const ENTRETIEN_STATUS_LABEL_KEY: Record<string, string> = {
  PLANIFIE: 'interviewStatusPlanned',
  REALISE: 'interviewStatusRealised',
  ANNULE: 'interviewStatusCancelled',
}

export const PREOCCUPATION_OPTIONS = [
  { value: 'SCOLAIRE',       labelKey: 'preoccupationScolaire' },
  { value: 'COMPORTEMENTAL', labelKey: 'preoccupationComportemental' },
  { value: 'FAMILIAL',       labelKey: 'preoccupationFamilial' },
  { value: 'PROFESSIONNEL',  labelKey: 'preoccupationProfessionnel' },
  { value: 'SANTE',          labelKey: 'preoccupationSante' },
  { value: 'AUTRE',          labelKey: 'preoccupationAutre' },
]

export const CHECKPOINT_STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  CALCULEE:           { bg: 'var(--blue-light)', color: 'var(--blue)' },
  VALIDEE_CONSEILLER: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  PROPOSEE_A_L_ELEVE: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  VALIDEE_ELEVE:      { bg: 'var(--green-light)', color: 'var(--green)' },
  VALIDEE_PAR_DEFAUT: { bg: 'var(--green-light)', color: 'var(--green)' },
}

export const CHECKPOINT_STATUS_LABEL_KEY: Record<string, string> = {
  CALCULEE: 'checkpointStatusCalculee',
  VALIDEE_CONSEILLER: 'checkpointStatusValideeConseiller',
  PROPOSEE_A_L_ELEVE: 'checkpointStatusProposeeEleve',
  VALIDEE_ELEVE: 'checkpointStatusValideeEleve',
  VALIDEE_PAR_DEFAUT: 'checkpointStatusValideeParDefaut',
}

export const CONFIDENCE_STYLE: Record<string, { bg: string; color: string }> = {
  ELEVEE:  { bg: 'var(--green-light)', color: 'var(--green)' },
  MOYENNE: { bg: 'var(--amber-light)', color: 'var(--amber)' },
  FAIBLE:  { bg: 'var(--red-light)', color: 'var(--red)' },
}

export const CONFIDENCE_LABEL_KEY: Record<string, string> = {
  ELEVEE: 'confidenceHigh',
  MOYENNE: 'confidenceMedium',
  FAIBLE: 'confidenceLow',
}

export const CHECKPOINT_TYPE_LABEL_KEY: Record<string, string> = {
  FIN_TROISIEME: 'checkpointFinTroisieme',
  FIN_SECONDE_C: 'checkpointFinSecondeC',
}

export const RISK_OPTIONS = [
  { value: 'FAIBLE',   labelKey: 'riskFaible' },
  { value: 'MOYEN',    labelKey: 'riskMoyen' },
  { value: 'ELEVE',    labelKey: 'riskEleve' },
  { value: 'CRITIQUE', labelKey: 'riskCritique' },
]

export const RECO_SERIES = ['A4', 'B', 'C', 'D', 'E', 'TI', 'ABI', 'G', 'H', 'F']

export function fmtOrientationDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export const sTitle: React.CSSProperties = {
  fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 20, fontWeight: 700, color: 'var(--text)',
}
export const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
export const btnPrim: React.CSSProperties = {
  padding: '6px 13px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white',
  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
}
export const btnSec: React.CSSProperties = {
  padding: '5px 11px', borderRadius: 8, fontSize: 12, fontWeight: 600,
  background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)',
  cursor: 'pointer', fontFamily: 'inherit',
}
export const sSelect: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 8, fontSize: 12, border: '1px solid var(--border)',
  background: 'var(--surface)', color: 'var(--text2)', fontFamily: 'inherit', cursor: 'pointer',
}
export const sInput: React.CSSProperties = {
  width: '100%', padding: '6px 10px', borderRadius: 8, fontSize: 12.5,
  border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)',
  fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 10,
}
export const sLabel: React.CSSProperties = { fontSize: 11.5, fontWeight: 600, color: 'var(--text3)', marginBottom: 4 }
export const sError: React.CSSProperties = {
  background: 'var(--red-light)', color: 'var(--red)', borderRadius: 6,
  padding: '6px 10px', fontSize: 12, fontWeight: 600, marginTop: 4,
}
export const sModalTitle: React.CSSProperties = {
  fontFamily: 'var(--font-spectral),Spectral,serif', fontSize: 17, fontWeight: 700,
  color: 'var(--text)', marginBottom: 14,
}
