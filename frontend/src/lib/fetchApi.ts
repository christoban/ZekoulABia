/**
 * Fetch wrapper qui tente un refresh silencieux sur 401.
 *
 * Garanties :
 * 1. Déduplication : plusieurs appels concurrents (React Strict Mode double-effet,
 *    plusieurs composants au montage) partagent la même promesse de refresh —
 *    un seul refresh part vers le serveur, évitant le conflit de refreshTokenVersion.
 *
 * 2. Retry réseau : si le refresh échoue par erreur réseau (serveur en redémarrage,
 *    nodemon/tsx watch), on attend 2 s et on retente une fois avant de rendre forfait.
 */

let refreshingPromise: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  try {
    const r = await fetch('/api/v2/users/auth/refresh', {
      method: 'POST',
      credentials: 'include',
    })
    return r.ok
  } catch {
    return false
  }
}

export async function fetchApi(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const res = await fetch(input, { credentials: 'include', ...init })

  if (res.status !== 401) return res

  if (!refreshingPromise) {
    refreshingPromise = doRefresh()
      .then(async (ok) => {
        if (ok) return true
        // Première tentative échouée — peut-être un redémarrage serveur en dev
        // On attend 2 s puis on retente une fois
        await new Promise(r => setTimeout(r, 2000))
        return doRefresh()
      })
      .finally(() => { refreshingPromise = null })
  }

  const refreshed = await refreshingPromise
  if (!refreshed) {
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem('zekoulabia_user') } catch { /* ignore */ }
    }
    return res
  }

  return fetch(input, { credentials: 'include', ...init })
}
