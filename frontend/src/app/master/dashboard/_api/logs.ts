import { apiFetch } from './client'

export interface AuditLogDto {
  id: string
  masterUserId?: string | null
  action: string
  targetId?: string | null
  description?: string | null
  ipAddress?: string | null
  createdAt: string
  masterUser?: { id: string; email: string; name: string } | null
}

export async function fetchLogs(params?: {
  action?: string
  type?: 'auth' | 'actions' | 'all'
  page?: number
  limit?: number
}): Promise<{ data: AuditLogDto[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
  const query = new URLSearchParams()
  if (params?.action) query.set('action', params.action)
  if (params?.type)   query.set('type', params.type)
  if (params?.page)   query.set('page', String(params.page))
  if (params?.limit)  query.set('limit', String(params.limit))
  const qs = query.toString()
  const res = await apiFetch<AuditLogDto[]>(`/api/v2/master/auth/logs${qs ? `?${qs}` : ''}`)
  return { data: res.data ?? [], pagination: res.pagination ?? { page: 1, limit: 50, total: 0, pages: 0 } }
}

export interface EmailLogDto {
  id: string
  to: string
  subject: string
  status: string
  provider?: string | null
  createdAt: string
  school?: { id: string; name: string; subdomain: string } | null
}

export async function fetchEmailLogs(params?: {
  search?: string
  schoolId?: string
  page?: number
  limit?: number
}): Promise<{ data: EmailLogDto[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
  const query = new URLSearchParams()
  if (params?.search)   query.set('search', params.search)
  if (params?.schoolId) query.set('schoolId', params.schoolId)
  if (params?.page)     query.set('page', String(params.page))
  if (params?.limit)    query.set('limit', String(params.limit))
  const qs = query.toString()
  const res = await apiFetch<EmailLogDto[]>(`/api/v2/master/email-logs${qs ? `?${qs}` : ''}`)
  return { data: res.data ?? [], pagination: res.pagination ?? { page: 1, limit: 50, total: 0, pages: 0 } }
}

// ── Sécurité de l'assistant IA — vue plateforme (chantier Sécurité de l'assistant IA) ─────────

export interface AIActionAuditLogDto {
  id: string
  timestamp: string
  actorUserId: string
  actorRole: string
  schoolId?: string | null
  actionName: string
  targetType?: string | null
  targetId?: string | null
  origin: 'UI_DIRECT' | 'AI_ASSISTANT'
  outcome: 'SUCCES' | 'REFUSE' | 'ERREUR'
  refusalReason?: string | null
  triggeringMessage?: string | null
}

export async function fetchAIActionAuditLog(params?: {
  schoolId?: string
  outcome?: 'SUCCES' | 'REFUSE' | 'ERREUR'
  origin?: 'UI_DIRECT' | 'AI_ASSISTANT'
  actorRole?: string
  actionName?: string
  page?: number
  limit?: number
}): Promise<{ data: AIActionAuditLogDto[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
  const query = new URLSearchParams()
  if (params?.schoolId)   query.set('schoolId', params.schoolId)
  if (params?.outcome)    query.set('outcome', params.outcome)
  if (params?.origin)     query.set('origin', params.origin)
  if (params?.actorRole)  query.set('actorRole', params.actorRole)
  if (params?.actionName) query.set('actionName', params.actionName)
  if (params?.page)       query.set('page', String(params.page))
  if (params?.limit)      query.set('limit', String(params.limit))
  const qs = query.toString()
  const res = await apiFetch<AIActionAuditLogDto[]>(`/api/v2/master/security-audit-log${qs ? `?${qs}` : ''}`)
  return { data: res.data ?? [], pagination: res.pagination ?? { page: 1, limit: 50, total: 0, pages: 0 } }
}
