/**
 * Registre de classification des actions hors-ligne — source unique du niveau de risque
 * par type d'action. Une action FORT ne peut PAS être mise en file hors-ligne (sa correction
 * n'existe pas dans le domaine) : elle est refusée immédiatement avec OfflineActionRefusedError.
 */
import type { PendingAction } from './db'

export type PendingActionType = PendingAction['type']

export type RiskLevel = 'MOYEN' | 'FORT'

export const OPERATION_RISK_LEVEL: Record<PendingActionType, RiskLevel> = {
  ATTENDANCE: 'MOYEN',
  GRADE: 'FORT',
  GRADE_DRAFT_SAVE: 'MOYEN',
  CAHIER_DE_TEXTE_CREATE: 'MOYEN',
  APPRECIATION_PP: 'MOYEN',
  DISCIPLINE_SANCTION: 'MOYEN',
  DISCIPLINE_SANCTION_LIFT: 'MOYEN',
  APEE_TRANSACTION: 'FORT',
  LIBRARY_BOOK_CREATE: 'MOYEN',
  LIBRARY_BOOK_UPDATE: 'MOYEN',
  TEACHER_ASSIGNMENT: 'MOYEN',
  TIMETABLE_GRID_CONFIG: 'MOYEN',
  PEDAGOGY_PROGRAM: 'MOYEN',
  ORIENTATION_RECORD: 'MOYEN',
  MESSAGE_SEND: 'MOYEN',
  ENROLLMENT_DRAFT: 'MOYEN',
  EXAM_ATTENDANCE: 'MOYEN',
  ENROLLMENT_VALIDATE: 'FORT',
  ENROLLMENT_ACTIVATE: 'FORT',
  EXAM_PUBLISH: 'FORT',
}

export class OfflineActionRefusedError extends Error {
  constructor(actionType: PendingActionType) {
    super(
      `Cette action (${actionType}) ne peut pas être effectuée hors-ligne : nécessite une connexion internet`,
    )
    this.name = 'OfflineActionRefusedError'
  }
}