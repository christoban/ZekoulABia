/**
 * Helper de synchronisation différentielle (Delta Sync) — Phase 3 Offline-First.
 * Fournit l'extraction propre du paramètre ?since= et le formatage standardisé
 * de la réponse serveur avec horodatage de référence (serverTime) pour économiser la data.
 */

export interface DeltaSyncResponse<T> {
  success: true;
  serverTime: string;
  isDelta: boolean;
  items: T[];
  deletedIds?: string[];
  pagination?: {
    total: number;
    page: number;
    pages: number;
    limit: number;
  };
}

/**
 * Valide et convertit un timestamp ISO passé en query param `since`.
 * Retourne `undefined` si absent ou invalide.
 */
export function parseSinceParam(since?: string | null): Date | undefined {
  if (!since) return undefined;
  const date = new Date(since);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

/**
 * Construit un objet de réponse différentielle normalisé.
 */
export function buildDeltaResponse<T>(params: {
  items: T[];
  isDelta: boolean;
  deletedIds?: string[];
  pagination?: { total: number; page: number; pages: number; limit: number };
}): DeltaSyncResponse<T> {
  return {
    success: true,
    serverTime: new Date().toISOString(),
    isDelta: params.isDelta,
    items: params.items,
    ...(params.deletedIds ? { deletedIds: params.deletedIds } : {}),
    ...(params.pagination ? { pagination: params.pagination } : {}),
  };
}
