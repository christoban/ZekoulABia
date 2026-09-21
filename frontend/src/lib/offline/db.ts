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

class ZekoulABiaDB extends Dexie {
  pendingActions!: Table<PendingAction>
  cachedData!: Table<CachedData>
  messages!: Table<CachedMessageChiffre>

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

/** Ajoute une action hors ligne à la file d'attente, payload chiffré. */
export async function addPendingAction(
  action: Omit<PendingAction, 'id' | 'status' | 'createdAt' | 'idempotencyKey' | 'payload'> & { payload: unknown }
): Promise<void> {
  const payloadChiffre = await chiffrer(action.payload)
  await db.pendingActions.add({
    ...action,
    payload: payloadChiffre,
    status: 'PENDING',
    createdAt: Date.now(),
    idempotencyKey: crypto.randomUUID(),
  })
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
