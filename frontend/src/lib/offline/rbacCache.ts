'use client'

/**
 * Cache RBAC gradué — lecture typée de localStorage.zekoulabia_user avec TTL
 * par catégorie d'opération (LECTURE/ECRITURE/DESTRUCTIF).
 *
 * Le cache ne sert qu'à l'UX (masquer/griser des boutons). Il ne doit JAMAIS
 * être la source d'autorisation pour des actions DESTRUCTIF — le serveur
 * revalide systématiquement via requireRole/authorizeSchool.
 *
 * TTL :
 *  - LECTURE   : 10 minutes (données relatively stables, navigation UI)
 *  - ECRITURE  : 2 minutes (données modifiables, mais le cache aide l'UX)
 *  - DESTRUCTIF : 0 (pas de cache, revalidation serveur systématique)
 */
import type { PendingActionType } from '@/lib/offline/actionRegistry'

// ─── Types ──────────────────────────────────────────────────────────────────

export type StaffPermissionType =
  | 'MANAGE_TIMETABLE' | 'VALIDATE_GRADES' | 'MANAGE_EXAMS'
  | 'SUPERVISE_TEACHERS' | 'MANAGE_ATTENDANCE' | 'MANAGE_DISCIPLINE'
  | 'MANAGE_INCIDENTS' | 'MANAGE_FINANCE' | 'VALIDATE_PAYMENTS'
  | 'GENERATE_REPORTS' | 'MANAGE_ATELIERS' | 'MANAGE_PRACTICAL_GRADES'
  | 'MANAGE_INTERNSHIPS' | 'MANAGE_STAGE_CONVENTIONS' | 'MANAGE_WORKSHOP_STOCK'
  | 'VIEW_DEPARTMENT_GRADES' | 'SUPERVISE_DEPARTMENT_TEACHERS'
  | 'VALIDATE_DEPARTMENT_TIMETABLE' | 'GENERATE_DEPARTMENT_REPORTS'
  | 'VIEW_SUPERVISED_GRADES' | 'SUPERVISE_LESSON_PLANS'
  | 'GENERATE_PEDAGOGICAL_REPORTS' | 'MANAGE_CE_REPORTS' | 'MANAGE_PEDAGOGICAL_BRIEF'
  | 'MANAGE_CLASS_COUNCIL' | 'MANAGE_CATCHUP_REQUESTS'
  | 'MANAGE_PATRIMOINE' | 'MANAGE_DEGRADATIONS'
  | 'MANAGE_LIBRARY' | 'MANAGE_ORIENTATION' | 'MANAGE_ENROLLMENT'

export type OperationCategory = 'LECTURE' | 'ECRITURE' | 'DESTRUCTIF'

export interface CachedUser {
  userId?: string
  role?: string
  nomComplet?: string
  firstName?: string
  permissions?: string[]
}

const STORAGE_KEY = 'zekoulabia_user'
const CACHE_META_KEY = 'zekoulabia_rbac_cache_meta'

// ─── Catégorisation des opérations ───────────────────────────────────────────

/**
 * Mapping type d'action → catégorie d'opération.
 * LECTURE = consultation/navigation (safe, TTL long)
 * ECRITURE = création/modification non destructive (TTL court)
 * DESTRUCTIF = suppression/annulation/irréversible (pas de cache)
 */
export const OPERATION_CATEGORY: Record<PendingActionType, OperationCategory> = {
  ATTENDANCE: 'ECRITURE',
  GRADE: 'DESTRUCTIF',
  GRADE_DRAFT_SAVE: 'ECRITURE',
  CAHIER_DE_TEXTE_CREATE: 'ECRITURE',
  APPRECIATION_PP: 'ECRITURE',
  DISCIPLINE_SANCTION: 'ECRITURE',
  DISCIPLINE_SANCTION_LIFT: 'ECRITURE',
  APEE_TRANSACTION: 'DESTRUCTIF',
  LIBRARY_BOOK_CREATE: 'ECRITURE',
  LIBRARY_BOOK_UPDATE: 'ECRITURE',
  TEACHER_ASSIGNMENT: 'ECRITURE',
  TIMETABLE_GRID_CONFIG: 'ECRITURE',
  PEDAGOGY_PROGRAM: 'ECRITURE',
  ORIENTATION_RECORD: 'ECRITURE',
  MESSAGE_SEND: 'ECRITURE',
  ENROLLMENT_DRAFT: 'ECRITURE',
  EXAM_ATTENDANCE: 'ECRITURE',
  ENROLLMENT_VALIDATE: 'DESTRUCTIF',
  ENROLLMENT_ACTIVATE: 'DESTRUCTIF',
  EXAM_PUBLISH: 'DESTRUCTIF',
}

/** TTL en millisecondes par catégorie */
const CACHE_TTL_MS: Record<OperationCategory, number> = {
  LECTURE: 10 * 60 * 1000,   // 10 minutes
  ECRITURE: 2 * 60 * 1000,   // 2 minutes
  DESTRUCTIF: 0,              // pas de cache
}

// ─── Cache interne ──────────────────────────────────────────────────────────

interface CacheMeta {
  cachedAt: Record<OperationCategory, number>
  version: number
}

let cachedUser: CachedUser | null = null
let cacheMeta: CacheMeta = {
  cachedAt: { LECTURE: 0, ECRITURE: 0, DESTRUCTIF: 0 },
  version: 0,
}

// ─── API publique ───────────────────────────────────────────────────────────

export function getCachedUser(): CachedUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as CachedUser
    if (!parsed || typeof parsed !== 'object') return null
    cachedUser = parsed
    return parsed
  } catch {
    return null
  }
}

/**
 * Vérifie une permission avec cache gradué.
 * DESTRUCTIF : toujours revalide côté serveur (retourne la valeur cache mais le composant
 * doit appeler revaliderRBACServeur() avant d'exécuter l'action).
 * LECTURE/ECRITURE : utilise le cache tant qu'il n'est pas expiré.
 */
export function hasPermission(permission: StaffPermissionType, category: OperationCategory = 'LECTURE'): boolean {
  // Pas de cache pour DESTRUCTIF — toujours revalidation serveur
  if (category === 'DESTRUCTIF') {
    return hasPermissionFresh(permission)
  }

  // Vérifier TTL pour LECTURE/ECRITURE
  const now = Date.now()
  const ttl = CACHE_TTL_MS[category]
  const cachedAt = cacheMeta.cachedAt[category]
  if (now - cachedAt > ttl) {
    // Cache expiré → relecture de localStorage
    getCachedUser()
    cacheMeta.cachedAt[category] = now
  }

  return (cachedUser?.permissions ?? []).includes(permission)
}

/**
 * Vérifie une permission en re-lisant localStorage directement (pas de cache).
 * Utilisé pour les actions DESTRUCTIF qui ne doivent jamais se fier au cache.
 */
function hasPermissionFresh(permission: StaffPermissionType): boolean {
  const user = getCachedUser()
  return (user?.permissions ?? []).includes(permission)
}

/**
 * Invalide tout le cache RBAC. À appeler après :
 * - Changement de rôle/permissions (login, modification de profil)
 * - Déconnexion
 * - Changement de session
 */
export function invalidateRBACCache(): void {
  cachedUser = null
  cacheMeta = {
    cachedAt: { LECTURE: 0, ECRITURE: 0, DESTRUCTIF: 0 },
    version: 0,
  }
}

/**
 * Retourne le TTL en secondes pour une catégorie donnée (utile pour debug/UI).
 */
export function getCacheTTL(category: OperationCategory): number {
  return CACHE_TTL_MS[category] / 1000
}

/**
 * Retourne la catégorie d'opération pour un type d'action donné.
 */
export function getOperationCategory(actionType: PendingActionType): OperationCategory {
  return OPERATION_CATEGORY[actionType]
}
