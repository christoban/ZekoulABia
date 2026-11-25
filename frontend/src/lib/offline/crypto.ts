const STORAGE_KEY = 'zekoulabia_offline_key'

async function getOrCreateKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const jwk = JSON.parse(stored)
    return crypto.subtle.importKey('jwk', jwk, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  const jwk = await crypto.subtle.exportKey('jwk', key)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jwk))
  return key
}

/**
 * Chiffre une valeur arbitraire (sérialisée en JSON) pour stockage IndexedDB. Protège contre une
 * consultation occasionnelle du stockage local (appareil partagé/emprunté) — PAS contre un
 * attaquant ayant un accès JS complet à cette origine (limite structurelle de tout chiffrement
 * côté client web, la clé doit être accessible au JS de la page pour être utilisable).
 */
export async function chiffrer(valeur: unknown): Promise<{ iv: number[]; data: number[] }> {
  const key = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(valeur))
  const buffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return { iv: Array.from(iv), data: Array.from(new Uint8Array(buffer)) }
}

/**
 * Déchiffre une valeur précédemment chiffrée par `chiffrer()`. Tolère un payload en clair
 * (format pré-migration v2 d'IndexedDB) : si la valeur n'a pas la forme `{ iv, data }`, elle est
 * retournée telle quelle — filet de sécurité pour une entrée qui aurait échappé à la conversion
 * de l'upgrade hook (voir db.ts), jamais pour des données écrites après la migration.
 */
export async function dechiffrer<T>(chiffre: { iv: number[]; data: number[] } | unknown): Promise<T> {
  const c = chiffre as { iv?: unknown; data?: unknown } | null
  if (!c || !Array.isArray(c.iv) || !Array.isArray(c.data)) {
    return chiffre as T
  }
  const key = await getOrCreateKey()
  const iv = new Uint8Array(c.iv as number[])
  const data = new Uint8Array(c.data as number[])
  const buffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return JSON.parse(new TextDecoder().decode(buffer))
}

/** À appeler sur déconnexion explicite (tâche 8) — rend tout contenu résiduel illisible. */
export function purgerCle(): void {
  localStorage.removeItem(STORAGE_KEY)
}
