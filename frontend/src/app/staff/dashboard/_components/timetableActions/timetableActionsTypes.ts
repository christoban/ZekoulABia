import type React from 'react'

export interface Assignment {
  subjectId: string
  subjectName: string
  currentTeacherId: string | null
  currentTeacherName: string | null
}

export interface Room {
  id: string
  name: string
  type: string
  status: string
  capacity: number
}

export interface Group {
  id: string
  name: string
  subjectId?: string | null
}

export interface GroupSet {
  id: string
  name: string
  groups: Group[]
}

export interface ProposedSession {
  subjectId: string
  teacherId: string
  roomId: string
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface ProposedGroupSession extends ProposedSession {
  groupId: string
  groupName: string
  participantsCount: number
  isLV2Slot: true
}

export interface ProposedFreeTime {
  kind: 'FREE'
  dayOfWeek: number
  startTime: string
  endTime: string
}

export interface Proposal {
  statut: 'OPTIMAL' | 'FEASIBLE' | 'INFAISABLE'
  seances: ProposedSession[]
  seancesGroupes?: ProposedGroupSession[]
  tempsLibres?: ProposedFreeTime[]
  scoreObjectif: number
  dureeResolutionMs: number
  raisonInfaisabilite?: string
  problemes?: string[]
  suggestions?: string[]
  explicatifs?: string[]
  avertissements?: string[]
}

export interface AsyncGenerationRun {
  id: string
  academicYearId: string
  status: string
  progress?: { targets?: Array<{ classId: string }> }
  results?: Array<{
    classId: string
    timetableId?: string
    status: string
    seances?: ProposedSession[]
    seancesGroupes?: ProposedGroupSession[]
    warnings?: string[]
    error?: string
  }>
}

export interface SimulationResult {
  propositionSimulee: Proposal
  differences: {
    seancesDeplacees: number
    scoreBase: number
    scoreSimule: number
    avertissements: string[]
  }
}

export interface TimetableLike {
  id: string
  status: string
}

export type BusyAction = 'propose' | 'apply' | 'whatif' | 'adjust' | 'group' | 'room' | null

export const RUN_STORAGE_PREFIX = 'zekoulabia_timetable_run_'
export const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi']

export type ReponseApi<T> = T & { message?: string; data?: T }

export async function lireReponseJson<T>(reponse: Response): Promise<ReponseApi<T>> {
  const texte = await reponse.text()
  if (!texte.trim()) throw new Error(`Réponse vide du serveur (HTTP ${reponse.status})`)
  try {
    return JSON.parse(texte) as ReponseApi<T>
  } catch {
    throw new Error(`Réponse invalide du serveur (HTTP ${reponse.status})`)
  }
}

export const attendre = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export const actionButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 8,
  border: 'none',
  background: 'linear-gradient(135deg,var(--primary),var(--primary-hover))',
  color: 'white',
  fontSize: 12,
  fontWeight: 750,
  cursor: 'pointer',
  opacity: 1,
}

export const secondaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 12px',
  borderRadius: 8,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text2)',
  fontSize: 12,
  fontWeight: 700,
  cursor: 'pointer',
}

export const iconButton: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--text3)',
  cursor: 'pointer',
  display: 'inline-flex',
  padding: 3,
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 9px',
  borderRadius: 7,
  border: '1px solid var(--border)',
  background: 'var(--surface)',
  color: 'var(--text)',
  fontSize: 12,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
}

export const sessionRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 10,
  padding: '6px 8px',
  borderRadius: 6,
  background: 'var(--bg)',
  color: 'var(--text2)',
  fontSize: 11.5,
}
