// URL relative → les appels passent par le proxy Next.js (next.config.ts rewrites)
// Fonctionne en local ET via ngrok sans aucune configuration supplémentaire
const API_BASE = ''

export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  pagination?: { page: number; limit: number; total: number; pages: number }
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public payload?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data = (await res.json()) as ApiResponse<T> & Record<string, unknown>
  if (!data.success) throw new ApiError(data.message || 'Erreur serveur', res.status, data)
  return data
}
