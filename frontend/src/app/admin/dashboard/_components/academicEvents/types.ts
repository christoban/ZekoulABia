export interface ModalNouvelEvenementProps {
  isOpen: boolean
  initialType?: string
  onClose: () => void
  onSuccess: () => void
  onToast: (msg: string, type?: 'success' | 'error' | 'info' | 'warning') => void
}

export interface SubjectItem {
  name: string
  coefficient: number
  maxScore: number
  eliminatoryScore: number | null
}

export interface ClassOption {
  id: string
  name: string
  level: string
}

export type EventCategory = 'FIXED_DATE' | 'MANUAL_TRIGGER' | 'SLIDING_WINDOW'

export const EVENT_TYPES = [
  'CONCOURS_ENTREE',
  'CHOIX_LV2',
  'RENTREE_6E_5E',
  'MIGRATION_BILINGUE',
  'CLOTURE_ANNEE',
  'AUTRE',
] as const

export const ALL_ROLES = ['ADMIN', 'STAFF', 'TEACHER', 'PARENT', 'STUDENT'] as const
