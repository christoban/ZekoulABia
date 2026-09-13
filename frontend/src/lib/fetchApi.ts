/**
 * Fetch wrapper qui tente un refresh silencieux uniquement lors de réponses HTTP 401.
 *
 * Garanties :
 * 1. Déduplication : plusieurs appels concurrents (React Strict Mode double-effet,
 *    plusieurs composants au montage) partagent la même promesse de refresh —
 *    un seul refresh part vers le serveur, évitant le conflit de refreshTokenVersion.
 *
 * 2. Protection de session dev / Retry de refresh : si la tentative de REFRESH
 *    (/api/v2/users/auth/refresh) échoue par erreur réseau (serveur dev en redémarrage),
 *    on retente une fois après 1.5 s et on N'ÉFACE PAS la session locale si le serveur
 *    n'a pas explicitement renvoyé un HTTP 401/403 (expired: true).
 *
 * Note : les requêtes métier normales ne sont NI interceptées NI retentées sur erreur réseau —
 * elles échouent directement en TypeError pour laisser la file offline (IndexedDB / Dexie)
 * gérer le mode hors ligne.
 */

let refreshingPromise: Promise<{ ok: boolean; expired?: boolean }> | null = null

async function doRefresh(): Promise<{ ok: boolean; expired?: boolean }> {
  try {
    const r = await fetch('/api/v2/users/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
    if (r.ok) return { ok: true }
    if (r.status === 401 || r.status === 403) return { ok: false, expired: true }
    return { ok: false }
  } catch {
    // Erreur réseau (serveur en redémarrage)
    return { ok: false }
  }
}

export async function fetchApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { credentials: 'include', ...init })

  if (res.status !== 401) return res

  if (!refreshingPromise) {
    refreshingPromise = doRefresh()
      .then(async (resRefresh) => {
        if (resRefresh.ok || resRefresh.expired) return resRefresh
        // Première tentative échouée par erreur réseau (redémarrage serveur dev)
        // On attend 1.5 s puis on retente une fois
        await new Promise(r => setTimeout(r, 1500))
        return doRefresh()
      })
      .finally(() => { refreshingPromise = null })
  }

  const outcome = await refreshingPromise
  if (!outcome.ok) {
    // Ne supprimer zekoulabia_user QUE si le serveur a explicitement rejeté le refreshToken (session révoquée/expirée)
    if (outcome.expired && typeof window !== 'undefined') {
      try { localStorage.removeItem('zekoulabia_user') } catch { /* ignore */ }
    }
    return res
  }

  return fetch(input, { credentials: 'include', ...init })
}
