import type React from 'react'
import type {
  ProposalPreviewGroupSession,
  ProposalPreviewMissingHours,
  ProposalPreviewSession,
} from '../TimetableProposalPreview'

export const FREE_VALUE = '__FREE__'
export const GLOBAL_RUN_STORAGE_KEY = 'zekoulabia_timetable_global_run'

export async function lireReponseJson<T>(reponse: Response): Promise<T> {
  const texte = await reponse.text()
  if (!texte.trim()) throw new Error(`Réponse vide du serveur (HTTP ${reponse.status})`)
  try {
    return JSON.parse(texte) as T
  } catch {
    throw new Error(`Réponse invalide du serveur (HTTP ${reponse.status})`)
  }
}

export interface GridConfig {
  heureDebut: string
  dureePeriode: number
  periodesAvantP1: number
  dureePetitePause: number
  periodesAvantP2: number
  dureeGrandePause: number
  periodesApresP2: number
  joursActifs: string[]
  periodesCoursParJour: Record<string, number>
}

export interface Assignment {
  subjectId: string
  subjectName: string
  coefficient: number
  currentTeacherId: string | null
  currentTeacherName: string | null
  eligibleTeachers: { id: string; name: string }[]
}

export interface BulkProposal {
  seances: ProposalPreviewSession[]
  seancesGroupes: ProposalPreviewGroupSession[]
}

export interface BulkResult {
  classId: string
  className: string
  timetableId?: string
  status: 'success' | 'PARTIEL' | 'error' | 'applied' | 'DEGRADE' | 'IGNORE_EDT_VERROUILLE' | 'NON_TRAITE' | 'ECHEC_TECHNIQUE'
  error?: string
  warnings: string[]
  heuresNonPlacees?: ProposalPreviewMissingHours[]
  diagnostic?: { relaxedPedagogicalRules?: boolean; relaxedProblems?: string[]; problems?: string[] }
  degradeDetails?: string[]
  proposal?: BulkProposal
}

export interface GenerationRunData {
  id: string
  academicYearId: string
  status: string
  progress?: { current?: number; total?: number; className?: string; targets?: Array<{ classId: string; timetableId?: string }> }
  results?: Array<Record<string, unknown>>
}

export const sTitle: React.CSSProperties = { fontFamily: 'var(--font-spectral,Spectral,serif)', fontSize: 20, fontWeight: 700, color: 'var(--text)' }
export const sSub: React.CSSProperties = { fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }
export const btnPrim: React.CSSProperties = { padding: '7px 14px', borderRadius: 8, fontSize: 12.5, fontWeight: 700, background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))', color: 'white', border: 'none', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center' }
export const btnSec: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'var(--surface)', color: 'var(--text2)', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: 'inherit' }
export const selectSt: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', fontSize: 12.5, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }
export const thSt: React.CSSProperties = { padding: '7px 8px', textAlign: 'center', fontSize: 11, fontWeight: 800, color: 'var(--text3)', background: 'var(--bg2)', border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.4px' }
export const labelSt: React.CSSProperties = { display: 'block', fontSize: 11.5, fontWeight: 700, color: 'var(--text2)', marginBottom: 4 }
export const inputSt: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border)', fontSize: 12.5, fontWeight: 600, color: 'var(--text)', fontFamily: 'inherit', boxSizing: 'border-box', outline: 'none', background: 'var(--surface)' }
export const spinnerStyle: React.CSSProperties = { width: 28, height: 28, border: '2.5px solid var(--border)', borderTopColor: 'var(--green)', borderRadius: '50%', animation: 'edu-spin 0.7s linear infinite' }
