export type SessionRow = {
  id: string
  classId: string
  className?: string
  subjectId: string
  subjectName?: string
  scheduledDate: string
  status: string
  isAnonymized: boolean
  anonymatStatus: string
  correctionMode: 'OWN_CLASS' | 'CROSSED' | null
  academicSequenceId: string | null
}

export type RefItem = { id: string; name: string }
export type SequenceItem = { id: string; label: string }

export const STATUS_LABELS: Record<string, string> = {
  NONE: 'Non démarré',
  CODES_GENERES: 'Codes générés',
  EQUIPE_DESIGNEE: 'Équipe désignée',
  ANONYMISATION_EN_COURS: 'Anonymisation en cours',
  ANONYMISATION_TERMINEE: 'Anonymisation terminée',
  EN_CORRECTION: 'En correction',
  CORRECTION_TERMINEE: 'Correction terminée',
  RECONCILIE: 'Réconcilié',
}

export const STATUS_COLORS: Record<string, string> = {
  NONE: 'bg-gray-500/20 text-gray-600 dark:text-gray-300',
  CODES_GENERES: 'bg-blue-500/20 text-blue-600 dark:text-blue-300',
  EQUIPE_DESIGNEE: 'bg-indigo-500/20 text-indigo-600 dark:text-indigo-300',
  ANONYMISATION_EN_COURS: 'bg-amber-500/20 text-amber-700 dark:text-amber-300',
  ANONYMISATION_TERMINEE: 'bg-success/20 text-success',
  EN_CORRECTION: 'bg-purple-500/20 text-purple-600 dark:text-purple-300',
  CORRECTION_TERMINEE: 'bg-primary/20 text-primary',
  RECONCILIE: 'bg-success/20 text-success',
}
