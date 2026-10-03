/**
 * Moteur de synchronisation différentielle côté client (Delta Sync Engine) — Phase 3 Offline-First.
 * Économise jusqu'à 90% de bande passante mobile en ne transférant que les éléments modifiés
 * depuis le dernier curseur temporel (`since`), tout en maintenant la cohérence du cache local Dexie.
 */

import { getCachedData, putCachedData } from '@/lib/offline/db'
import { fetchApi } from '@/lib/fetchApi'

export interface DeltaSyncPayload<T> {
  success: boolean
  serverTime?: string
  isDelta?: boolean
  items?: T[]
  grades?: T[]
  records?: T[]
  data?: T[]
  deletedIds?: string[]
}

/**
 * Fusionne une liste existante avec les modifications incrémentales et applique les suppressions (tombstones).
 */
export function mergeDeltaCollection<T extends { id: string }>(
  existingItems: T[],
  updatedItems: T[],
  deletedIds: string[] = []
): T[] {
  const deletedSet = new Set(deletedIds)
  const updateMap = new Map(updatedItems.map((item) => [item.id, item]))

  // 1. Mettre à jour les éléments existants et exclure les éléments supprimés
  const result: T[] = []
  const seenIds = new Set<string>()

  for (const item of existingItems) {
    if (deletedSet.has(item.id)) {
      continue // Tombstone : élément supprimé côté serveur
    }
    if (updateMap.has(item.id)) {
      result.push(updateMap.get(item.id)!)
      seenIds.add(item.id)
    } else {
      result.push(item)
      seenIds.add(item.id)
    }
  }

  // 2. Insérer les nouveaux éléments ajoutés qui n'étaient pas dans la collection initiale
  for (const item of updatedItems) {
    if (!seenIds.has(item.id) && !deletedSet.has(item.id)) {
      result.push(item)
    }
  }

  return result
}

/**
 * Effectue un appel réseau différentiel avec ?since= horodaté, fusionne les données avec Dexie
 * et persiste la collection consolidée.
 */
export async function syncCollectionWithDelta<T extends { id: string }>(
  cacheKey: string,
  endpoint: string,
  extractItemsFn?: (payload: DeltaSyncPayload<T>) => T[]
): Promise<{ data: T[]; serverTime?: string; isDelta: boolean }> {
  // 1. Lire le cache local pour récupérer la date du dernier succès
  const cached = await getCachedData<{ items: T[]; serverTime?: string }>(cacheKey).catch(() => undefined)
  const lastSyncTime = cached?.data?.serverTime || (cached?.cachedAt ? new Date(cached.cachedAt).toISOString() : undefined)

  // 2. Construire l'URL avec le paramètre `since` si le cache est présent
  const url = new URL(endpoint, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
  if (lastSyncTime && cached?.data?.items && cached.data.items.length > 0) {
    url.searchParams.set('since', lastSyncTime)
  }

  // 3. Appel API
  const res = await fetchApi(url.pathname + url.search, { credentials: 'include' })
  const json: DeltaSyncPayload<T> = await res.json()

  if (!res.ok) {
    throw new Error('Erreur réseau lors de la synchronisation différentielle')
  }

  // Extraire les éléments de la réponse selon le format d'endpoint
  const incomingItems = extractItemsFn
    ? extractItemsFn(json)
    : (json.items || json.grades || json.records || json.data || [])

  const isDelta = Boolean(json.isDelta && cached?.data?.items)
  let consolidatedList: T[]

  if (isDelta && cached?.data?.items) {
    // Fusion différentielle
    consolidatedList = mergeDeltaCollection(cached.data.items, incomingItems, json.deletedIds || [])
  } else {
    // Rechargement complet
    consolidatedList = incomingItems
  }

  // 4. Mettre à jour le cache Dexie avec le timestamp serveur officiel
  await putCachedData(cacheKey, {
    items: consolidatedList,
    serverTime: json.serverTime || new Date().toISOString(),
  }).catch(() => {})

  return {
    data: consolidatedList,
    serverTime: json.serverTime,
    isDelta,
  }
}
