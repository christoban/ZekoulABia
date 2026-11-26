import type { CSSProperties } from 'react'
import type { UserInfo } from '../../_types'

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string

export interface DeptSubjectOption {
  id: string
  name: string
}

export interface DeptOption {
  id: string
  name: string
  color: string
  subjects?: DeptSubjectOption[]
}

export interface SectionDepartementAPProps {
  user: UserInfo
  departementId: string
  departementNom: string
  departmentsList?: DeptOption[]
  onSelectDept?: (id: string) => void
  onToast?: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export interface PerfRow {
  teacherName: string
  subjectName: string
  className: string
  moyenne: number | null
  nbEleves: number
}

export interface HoraireRow {
  teacherName: string
  subjectName: string
  totalHours: number
  isOverLimit: boolean
}

export interface Chapitre {
  id: string
  titre: string
  ordre: number
  volumeHeuresPrevu: number | null
  sequenceCibleFin?: number | null
  moduleOrdre?: number | null
  moduleTitre?: string | null
  numeroAffiche?: string | null
  retireDuReferentielLe?: string | null
  realise?: boolean
}

export interface Programme {
  id: string
  titre: string
  source?: string
  subject: { id: string; name: string }
  class: { id: string; name: string } | null
  level: string | null
  chapitres: Chapitre[]
}

export type DeptTab = 'performances' | 'horaires' | 'progression' | 'programmes'

export interface ProgAlerte {
  programmeTitre: string
  subjectName: string
  className: string
  chapitresTotal: number
  chapitresRealises: number
  modulesDesactivesCount?: number
  progressionPct: number
  attenduPct: number
  retardPct: number
  niveau: 'CRITIQUE' | 'MODERE'
}

export interface EditingChapitreState {
  id: string
  titre: string
  volumeHeuresPrevu: number | null
  sequenceCibleFin?: number | null
}

export const deptInputStyle: CSSProperties = {
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

export const deptLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--text3)',
  textTransform: 'uppercase',
  letterSpacing: '0.3px',
  marginBottom: 3,
  display: 'block',
}
