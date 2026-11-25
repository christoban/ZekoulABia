import type React from 'react'

export interface OnToast {
  (msg: string, type?: 'success' | 'error' | 'info' | 'warning'): void
}

export interface Subject {
  id: string
  name: string
}

export interface Classe {
  id: string
  name: string
  level?: string | null
}

export interface Chapitre {
  id: string
  titre: string
  ordre: number
  volumeHeuresPrevu: number
  sequenceCibleFin?: number | null
  realise?: boolean
}

export interface Programme {
  id: string
  titre: string
  subject: { id: string; name: string }
  class: { id: string; name: string } | null
  level: string | null
  chapitres: Chapitre[]
}

export interface Alerte {
  programmeId: string
  programmeTitre: string
  subjectName: string
  className: string
  classId: string
  chapitresTotal: number
  chapitresRealises: number
  progressionPct: number
  attenduPct: number
  retardPct: number
  niveau: 'CRITIQUE' | 'MODERE'
}

export interface ProgressionData {
  programme: { id: string; titre: string } | null
  chapitresTotal: number
  chapitresRealises: number
  totalHeuresPrevu: number
  heuresRealisees: number
  progressionPct: number | null
  attenduPct: number | null
  retardPct: number | null
  chapitres: (Chapitre & { realise: boolean })[]
}

export type Tab = 'programmes' | 'progression' | 'alertes' | 'rapports'

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 12px',
  borderRadius: 8,
  border: '1.5px solid var(--border)',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'inherit',
  color: 'var(--text)',
  background: 'var(--surface)',
  outline: 'none',
  boxSizing: 'border-box',
}

export const labelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text3)',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  marginBottom: 3,
  display: 'block',
}
