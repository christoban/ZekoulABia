import Dexie, { type Table } from 'dexie'
import { chiffrer, dechiffrer } from './crypto'

export interface PendingAction {
  id?: number
  type:
    | 'ATTENDANCE'
    | 'GRADE'
    | 'GRADE_DRAFT_SAVE'
    | 'CAHIER_DE_TEXTE_CREATE'
    | 'APPRECIATION_PP'
    | 'DISCIPLINE_SANCTION'
    | 'DISCIPLINE_SANCTION_LIFT'
    | 'APEE_TRANSACTION'
    | 'LIBRARY_BOOK_CREATE'
    | 'LIBRARY_BOOK_UPDATE'
    | 'TEACHER_ASSIGNMENT'
    | 'TIMETABLE_GRID_CONFIG'
    | 'PEDAGOGY_PROGRAM'
    | 'ORIENTATION_RECORD'
    | 'MESSAGE_SEND'
    | 'ENROLLMENT_DRAFT'
    | 'EXAM_ATTENDANCE'
    | 'ENROLLMENT_VALIDATE'
    | 'ENROLLMENT_ACTIVATE'
    | 'EXAM_PUBLISH'
    | 'FEE_PAYMENT_CASH'
    | 'EXPENSE_CREATE'
  payload: unknown
  endpoint: string
  method: 'POST' | 'PATCH'
  createdAt: number
  status: 'PENDING' | 'SYNCING' | 'FAILED' | 'CONFLICT'
  /**
   * Clé d'idempotence générée côté client (UUID v4) — Plan offline-first V1 §4 (pattern
   * Outbox). Envoyée au serveur dans l'en-tête `Idempotency-Key` à la synchronisation ;
   * permet au serveur de détecter une action déjà traitée (synchronisation interrompue puis
   * retentée) sans la ré-exécuter une seconde fois. Générée une fois à la création de
   * l'entrée, jamais régénérée sur retry — c'est précisément ce qui rend le retry sûr.
   */
  idempotencyKey: string
  /** Données de conflit (si status === 'CONFLICT') — un conflit par élève concerné. */
  conflictData?: {
    studentId: string;
    versionServeur: { updatedAt: string; sequenceScore: number | null };
    versionLocale: { updatedAt: string | null; value: number | null; observation: string | null };
  }[]
}

export interface CachedData {
  key: string
  data: unknown
  cachedAt: number
}

/**
 * Fil de conversation en cache local — distinct de `cachedData` (générique, invisible tant
 * qu'on ne le consulte pas) : un message envoyé doit apparaître IMMÉDIATEMENT dans le fil,
 * avant même confirmation serveur (affichage optimiste), avec un statut visible (horloge / coche
 * / alerte). `id` = `clientMessageId`, l'UUID généré au clic (Plan Messagerie §3.1) — c'est aussi
 * l'identifiant définitif côté serveur, donc aucune réconciliation d'ID nécessaire après sync.
 */
export interface CachedMessage {
  id: string
  conversationId: string
  senderId: string
  content: string
  createdAt: number
  status: 'PENDING' | 'SENT' | 'FAILED'
}

interface CachedMessageChiffre extends Omit<CachedMessage, 'content'> {
  content: { iv: number[]; data: number[] }
}

export interface SchoolInfoCached {
  name: string
  logoUrl: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
}

export interface UserSessionData {
  userId: string
  role: string
  nomComplet?: string
  firstName?: string
  lastName?: string
  schoolId?: string
  schoolInfo?: SchoolInfoCached | null
  fullProfile?: unknown
  permissions?: string[]
  cachedAt: number
}

class ZekoulABiaDB extends Dexie {
  pendingActions!: Table<PendingAction>
  cachedData!: Table<CachedData>
  messages!: Table<CachedMessageChiffre>
  userSession!: Table<UserSessionData>

  constructor() {
    super('ZekoulABiaDB')
    // v2 — Chiffrement au repos (Plan offline-first V1 §1) : les champs opaques (`data` dans
    // `cachedData`, `payload` dans `pendingActions`) sont désormais stockés sous la forme
    // chiffrée `{ iv, data }`. Les champs indexés (`key`, `type`, `status`, `createdAt`) restent
    // en clair — chiffrer un champ sur lequel Dexie fait un `where().equals()` casserait les
    // requêtes (AES-GCM inclut un nonce aléatoire par chiffrement, jamais égal à lui-même).
    // Migration : les entrées `cachedData` (cache de lecture reconstructible sans perte) sont
    // purgées ; les `pendingActions` en attente sont CONVERTIES au format chiffré au lieu d'être
    // supprimées — une action non synchronisée est une vraie donnée, jamais jetée silencieusement.
    this.version(1).stores({
      pendingActions: '++id, type, status, createdAt',
      cachedData: 'key, cachedAt',
    })
    this.version(2)
      .stores({
        pendingActions: '++id, type, status, createdAt',
        cachedData: 'key, cachedAt',
      })
      .upgrade(async (trans) => {
        await trans.table('cachedData').clear()
        const pending = await trans.table('pendingActions').toArray()
        for (const action of pending) {
          if (
            !action.payload
            || !(action.payload as { iv?: unknown; data?: unknown }).iv
            || !(action.payload as { iv?: unknown; data?: unknown }).data
          ) {
            const chiffre = await chiffrer(action.payload)
            await trans.table('pendingActions').put({ ...action, payload: chiffre })
          }
        }
      })
    // v3 — table dédiée aux fils de conversation (Plan Messagerie §3.4), séparée de la file
    // générique `pendingActions` : un message a besoin d'un affichage optimiste immédiat dans le
    // fil, pas juste d'être en attente dans une file invisible.
    this.version(3).stores({
      pendingActions: '++id, type, status, createdAt',
      cachedData: 'key, cachedAt',
      messages: 'id, conversationId, createdAt, status',
    })
    // v4 — store de session et profil enrichi offline (Phase 1 du Plan Offline-First) :
    // conserve en local le profil complet (école, rôles étendus PP/AP, filtres) pour
    // garantir un démarrage instantané < 30ms et sans dépendre d'un appel réseau /users/me.
    this.version(4).stores({
      pendingActions: '++id, type, status, createdAt',
      cachedData: 'key, cachedAt',
      messages: 'id, conversationId, createdAt, status',
      userSession: 'userId, role, cachedAt',
    })
  }
}

export const db = new ZekoulABiaDB()

/** Écrit une entrée de cache de lecture avec sa donnée chiffrée. */
export async function putCachedData(key: string, data: unknown): Promise<void> {
  const chiffre = await chiffrer(data)
  await db.cachedData.put({ key, data: chiffre, cachedAt: Date.now() })
}

/** Lit une entrée de cache de lecture et déchiffre sa donnée. */
export async function getCachedData<T>(key: string): Promise<{ data: T; cachedAt: number } | undefined> {
  const row = await db.cachedData.get(key)
  if (!row) return undefined
  return { data: await dechiffrer<T>(row.data), cachedAt: row.cachedAt }
}

/** Supprime une entrée de cache de lecture. */
export async function deleteCachedData(key: string): Promise<void> {
  await db.cachedData.delete(key)
}

/**
 * Purge les données de cache de lecture expirées (par défaut > 30 jours, décision architecturale validée).
 * Si le nombre d'entrées dépasse maxEntries (défaut 500), élimine les plus anciennes (algorithme LRU).
 * Protège scrupuleusement la table `pendingActions` (les données de l'Outbox ne sont JAMAIS supprimées ici).
 */
export async function purgeExpiredCache(maxAgeDays = 30, maxEntries = 500): Promise<number> {
  try {
    const cutoff = Date.now() - (maxAgeDays * 24 * 60 * 60 * 1000)
    let deletedCount = await db.cachedData.where('cachedAt').below(cutoff).delete()

    const totalCount = await db.cachedData.count()
    if (totalCount > maxEntries) {
      const excess = totalCount - maxEntries
      const oldestKeys = await db.cachedData
        .orderBy('cachedAt')
        .limit(excess)
        .primaryKeys()
      await db.cachedData.bulkDelete(oldestKeys)
      deletedCount += oldestKeys.length
    }
    return deletedCount
  } catch {
    return 0
  }
}

/** Ajoute une action hors ligne à la file d'attente, payload chiffré. */
export async function addPendingAction(
  action: Omit<PendingAction, 'id' | 'status' | 'createdAt' | 'idempotencyKey' | 'payload'> & {
    payload: unknown
    idempotencyKey?: string
  }
): Promise<string> {
  const payloadChiffre = await chiffrer(action.payload)
  const key = action.idempotencyKey || crypto.randomUUID()
  await db.pendingActions.add({
    ...action,
    payload: payloadChiffre,
    status: 'PENDING',
    createdAt: Date.now(),
    idempotencyKey: key,
  })
  return key
}

/** Liste toutes les actions en attente avec leur payload déchiffré. */
export async function getPendingActions(): Promise<PendingAction[]> {
  const rows = await db.pendingActions.toArray()
  return Promise.all(rows.map(async (r) => ({
    ...r,
    payload: await dechiffrer(r.payload),
    conflictData: r.conflictData ? await dechiffrer(r.conflictData as any) : undefined,
  })))
}

/** Compte les actions en attente (PENDING). */
export async function countPendingActions(): Promise<number> {
  return db.pendingActions.where('status').equals('PENDING').count()
}

/** Supprime une action de la file d'attente. */
export async function deletePendingAction(id: number): Promise<void> {
  await db.pendingActions.delete(id)
}

/** Met à jour le statut d'une action de la file d'attente. */
export async function updatePendingActionStatus(id: number, status: PendingAction['status']): Promise<void> {
  await db.pendingActions.update(id, { status })
}

/** Enregistre les données de conflit d'une action — chiffre conflictData comme payload. */
export async function setConflictData(id: number, conflictData: unknown): Promise<void> {
  const chiffre = await chiffrer(conflictData)
  await db.pendingActions.update(id, { conflictData: chiffre as any })
}

/** Écrit (ou met à jour) un message dans le fil local — affichage optimiste immédiat. */
export async function putCachedMessage(message: CachedMessage): Promise<void> {
  const chiffre = await chiffrer(message.content)
  await db.messages.put({ ...message, content: chiffre })
}

/** Lit le fil de conversation en cache, du plus ancien au plus récent. */
export async function getCachedMessages(conversationId: string): Promise<CachedMessage[]> {
  const rows = await db.messages.where('conversationId').equals(conversationId).sortBy('createdAt')
  return Promise.all(rows.map(async (r) => ({ ...r, content: await dechiffrer<string>(r.content) })))
}

/** Met à jour le statut d'envoi d'un message en cache (horloge → coche / alerte). */
export async function updateCachedMessageStatus(id: string, status: CachedMessage['status']): Promise<void> {
  await db.messages.update(id, { status })
}

/** Enregistre ou fusionne le profil enrichi et les données de session d'un utilisateur. */
export async function putUserSession(session: Partial<UserSessionData> & { userId: string; role: string }): Promise<void> {
  const existing = await db.userSession.get(session.userId)
  const merged: UserSessionData = {
    userId: session.userId,
    role: session.role,
    nomComplet: session.nomComplet ?? existing?.nomComplet ?? '',
    firstName: session.firstName ?? existing?.firstName ?? '',
    lastName: session.lastName ?? existing?.lastName ?? '',
    schoolId: session.schoolId ?? existing?.schoolId,
    schoolInfo: session.schoolInfo !== undefined ? session.schoolInfo : (existing?.schoolInfo ?? null),
    fullProfile: session.fullProfile !== undefined ? session.fullProfile : (existing?.fullProfile ?? null),
    permissions: session.permissions ?? existing?.permissions ?? [],
    cachedAt: Date.now(),
  }
  await db.userSession.put(merged)
}

/** Récupère la session enrichie d'un utilisateur par son ID. */
export async function getUserSession(userId: string): Promise<UserSessionData | undefined> {
  return db.userSession.get(userId)
}

/** Récupère la dernière session active en cache local. */
export async function getLatestUserSession(): Promise<UserSessionData | undefined> {
  const sessions = await db.userSession.orderBy('cachedAt').reverse().toArray()
  return sessions[0]
}

/** Supprime toutes les sessions utilisateurs en cache local (au logout). */
export async function clearUserSession(): Promise<void> {
  await db.userSession.clear()
}
