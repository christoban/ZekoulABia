/**
 * Helpers HTTP partagés (Admin, Staff, Enseignant / AP) pour les endpoints /api/v2/pedagogie/*.
 * Garantit :
 * - aucune exception SyntaxError si le serveur renvoie du HTML (ex. 404 Express quand le frontend
 *   est déployé avant le backend sur GET /materialisation/status, ou 403/502 reverse proxy) ;
 * - distinction explicite des refus 403 (jamais masqués par un cache Dexie périmé) ;
 * - repli sûr (enabled: false) lorsque /materialisation/status n'existe pas encore.
 */

export interface MaterialisationStatusResult {
  enabled: boolean
  unavailable: boolean
}

export type PedagogieHttpResult<T> =
  | { ok: true; data: T }
  | { ok: false; forbidden: boolean; status: number; message: string }

interface RawJsonPayload<T> {
  success?: boolean
  data?: T
  message?: string
  error?: string
}

export async function lireStatutMaterialisation(res: Response): Promise<MaterialisationStatusResult> {
  if (!res.ok) {
    return {
      enabled: false,
      unavailable: res.status === 404 || res.status === 405 || res.status === 501,
    }
  }
  const json = (await res.json().catch(() => null)) as RawJsonPayload<{ enabled?: boolean }> | null
  return {
    enabled: Boolean(json?.success && json.data?.enabled === true),
    unavailable: false,
  }
}

export async function lireReponsePedagogie<T>(
  res: Response,
  fallbackError: string,
  forbiddenFallback: string,
): Promise<PedagogieHttpResult<T>> {
  const json = (await res.json().catch(() => null)) as RawJsonPayload<T> | null
  const serverMessage =
    (typeof json?.message === 'string' && json.message.trim()) ||
    (typeof json?.error === 'string' && json.error.trim()) ||
    ''

  if (res.status === 403) {
    return {
      ok: false,
      forbidden: true,
      status: 403,
      message: serverMessage || forbiddenFallback,
    }
  }

  if (!res.ok || !json?.success) {
    return {
      ok: false,
      forbidden: false,
      status: res.status,
      message: serverMessage || fallbackError,
    }
  }

  return { ok: true, data: json.data as T }
}

