// URL relative → les appels passent par le proxy Next.js (next.config.ts rewrites)
// Fonctionne en local ET via ngrok sans aucune configuration supplémentaire
const API_BASE = ''

interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  pagination?: { page: number; limit: number; total: number; pages: number }
}

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  const data: ApiResponse<T> = await res.json()
  if (!data.success) throw new ApiError(data.message || 'Erreur serveur', res.status)
  return data
}

export interface MasterUserDto {
  id: string
  email: string
  name: string
  role: string
}

export interface SchoolDto {
  id: string
  name: string
  subdomain: string
  type: string
  plan: string
  status: string
  city?: string | null
  region?: string | null
  email?: string | null
  phone?: string | null
  logoUrl?: string | null
  createdAt: string
  invites?: { id: string; email: string; status: string; expiresAt: string; createdAt: string }[]
  users?: { email: string | null }[]
  _count?: { users: number; classes: number; subjects?: number; feePlans?: number }
  schoolConfig?: Record<string, unknown> | null
  schoolSettings?: Record<string, unknown> | null
}

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

export interface SchoolDetailDto extends SchoolDto {
  invites?: {
    id: string
    email: string
    schoolName: string
    token: string
    plan: string
    status: string
    expiresAt: string
    createdAt: string
  }[]
  schoolConfig?: Record<string, unknown> | null
  schoolSettings?: Record<string, unknown> | null
}

export async function fetchMe(): Promise<MasterUserDto> {
  const res = await apiFetch<MasterUserDto>('/api/v2/master/auth/me')
  if (!res.data) throw new Error('Données utilisateur introuvables')
  return res.data
}

export async function fetchSchools(params?: {
  status?: string
  search?: string
  page?: number
  limit?: number
}): Promise<{ data: SchoolDto[]; pagination: { page: number; limit: number; total: number; pages: number } }> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  if (params?.search) query.set('search', params.search)
  if (params?.page) query.set('page', String(params.page))
  if (params?.limit) query.set('limit', String(params.limit))
  const qs = query.toString()
  const res = await apiFetch<SchoolDto[]>(`/api/v2/master/schools${qs ? `?${qs}` : ''}`)
  return { data: res.data ?? [], pagination: res.pagination ?? { page: 1, limit: 50, total: 0, pages: 0 } }
}

export async function fetchSchoolDetail(id: string): Promise<SchoolDetailDto> {
  const res = await apiFetch<SchoolDetailDto>(`/api/v2/master/schools/${id}`)
  if (!res.data) throw new Error('École introuvable')
  return res.data
}

export async function inviteSchool(body: {
  email: string
  schoolName: string
  plan: string
  notes?: string
  sensitiveAuth: { password: string; code?: string }
}): Promise<void> {
  await apiFetch('/api/v2/master/schools/invite', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function fetchMasterMfaStatus(): Promise<{ mfaEnabled: boolean }> {
  const res = await apiFetch<{ mfaEnabled: boolean }>('/api/v2/master/auth/mfa-status')
  return res.data ?? { mfaEnabled: false }
}

export async function mfaSetup(): Promise<{ qrDataUri: string; manualKey: string }> {
  const res = await apiFetch<{ qrDataUri: string; manualKey: string }>('/api/v2/master/auth/mfa/setup', { method: 'POST', body: '{}' })
  if (!res.data) throw new Error('Erreur lors de la configuration MFA')
  return res.data
}

export async function mfaEnable(totpCode: string, password: string): Promise<{ recoveryCodes: string[] }> {
  const res = await apiFetch<{ recoveryCodes: string[] }>('/api/v2/master/auth/mfa/enable', {
    method: 'POST',
    body: JSON.stringify({ totpCode, sensitiveAuth: { password } }),
  })
  if (!res.data) throw new Error('Erreur lors de l\'activation MFA')
  return res.data
}

export async function mfaDisable(password: string, totpCode: string): Promise<void> {
  await apiFetch('/api/v2/master/auth/mfa/disable', {
    method: 'POST',
    body: JSON.stringify({ sensitiveAuth: { password, code: totpCode } }),
  })
}

export async function mfaRegenCodes(password: string, totpCode: string): Promise<{ recoveryCodes: string[] }> {
  const res = await apiFetch<{ recoveryCodes: string[] }>('/api/v2/master/auth/mfa/regen-codes', {
    method: 'POST',
    body: JSON.stringify({ sensitiveAuth: { password, code: totpCode } }),
  })
  if (!res.data) throw new Error('Erreur lors de la régénération')
  return res.data
}

// Débloque un compte Admin/Staff/Teacher ayant perdu l'accès à son authenticator ET à ses
// codes de récupération — le compte devra reconfigurer le MFA depuis zéro à sa prochaine connexion.
export async function resetUserMfa(subdomain: string, email: string, password: string, totpCode: string): Promise<void> {
  await apiFetch('/api/v2/master/users/mfa-reset', {
    method: 'POST',
    body: JSON.stringify({ subdomain, email, sensitiveAuth: { password, code: totpCode } }),
  })
}

export async function suspendSchool(id: string, reason?: string, sensitiveAuth?: { password: string; code?: string }): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || undefined, sensitiveAuth }),
  })
}

// Étape 1 — vérifier identité (password + MFA) → déclenche l'envoi d'un OTP par email
export async function initiatePasswordChange(body: {
  currentPassword: string
  mfaCode?: string
}): Promise<void> {
  await apiFetch('/api/v2/master/auth/password-change/initiate', {
    method: 'POST',
    body: JSON.stringify({
      sensitiveAuth: { password: body.currentPassword, ...(body.mfaCode ? { code: body.mfaCode } : {}) },
    }),
  })
}

// Étape 2 — vérifier OTP email + définir le nouveau mot de passe
export async function changePassword(body: {
  otp: string
  newPassword: string
}): Promise<void> {
  await apiFetch('/api/v2/master/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ otp: body.otp, newPassword: body.newPassword }),
  })
}

export async function reactivateSchool(id: string, sensitiveAuth?: { password: string; code?: string }): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/reactivate`, {
    method: 'POST',
    body: JSON.stringify({ sensitiveAuth }),
  })
}

export async function rejectSchool(id: string, motif: string, sensitiveAuth?: { password: string; code?: string }): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ motif, sensitiveAuth }),
  })
}

export async function approveSchool(id: string, sensitiveAuth?: { password: string; code?: string }): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/approve`, {
    method: 'POST',
    body: JSON.stringify({ sensitiveAuth }),
  })
}

export async function changeSchoolPlan(id: string, plan: string): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/plan`, {
    method: 'PATCH',
    body: JSON.stringify({ plan }),
  })
}

export async function cancelApproval(id: string, sensitiveAuth?: { password: string; code?: string }): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/cancel-approval`, {
    method: 'POST',
    body: JSON.stringify({ sensitiveAuth }),
  })
}

export async function reexamineSchool(id: string, sensitiveAuth?: { password: string; code?: string }): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/reexamine`, {
    method: 'POST',
    body: JSON.stringify({ sensitiveAuth }),
  })
}

export async function resendInvite(id: string, sensitiveAuth?: { password: string; code?: string }): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/resend-invite`, {
    method: 'POST',
    body: JSON.stringify({ sensitiveAuth }),
  })
}

export async function deleteSchool(id: string, sensitiveAuth?: { password: string; code?: string }): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({ sensitiveAuth }),
  })
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

// ─── RÉFÉRENTIELS NATIONAUX ────────────────────────────────────────────────

export interface ReferentielsSummaryDto {
  currentAcademicYear: string
  nextAcademicYear: string
  upcomingYearAlert: boolean
  alertMessage: string | null
  counts: {
    calendars: number
    bacCoefficients: number
    cycleSubjects: number
    progressions: number
    tarifs: number
    templates: number
  }
}

export interface OfficialAcademicCalendarDto {
  id: string
  academicYear: string
  establishmentType: string
  arreteReference?: string | null
  dateRentreeOfficielle: string
  dateClotureOfficielle: string
  trimestres: { name: string; startDate: string; endDate: string }[]
  periodesVacances: { name: string; startDate: string; endDate: string }[]
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface BacCoefficientDto {
  id: string
  subjectName: string
  serie: string
  niveau: 'SECONDE' | 'PREMIERE' | 'TERMINALE'
  coefficient: number
  groupe: number
  templateCode: string
  source: string
  isOfficialMinesec: boolean
}

export interface TemplateSubjectDto {
  id: string
  templateCode: string
  classLevel: string
  subjectName: string
  coefficient: number
  weeklyPeriods?: number | null
  filiere: string
}

export interface OfficialProgressionDto {
  id: string
  templateCode: string
  level: string
  filiere?: string | null
  subjectName: string
  titre: string
  chapitres: { ordre: number; titre: string; volumeHeuresPrevu: number; sequenceCibleFin?: number }[]
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface TarifMinesecDto {
  id: string
  typeFrais: string
  anneeScolaire: string
  niveau?: string | null
  montantFCFA: number
  description?: string | null
  actif: boolean
  createdAt: string
}

export async function fetchReferentielsSummary(): Promise<ReferentielsSummaryDto> {
  const res = await apiFetch<ReferentielsSummaryDto>('/api/v2/master/referentiels/summary')
  return res.data!
}

export async function fetchOfficialCalendars(): Promise<OfficialAcademicCalendarDto[]> {
  const res = await apiFetch<OfficialAcademicCalendarDto[]>('/api/v2/master/referentiels/calendar')
  return res.data ?? []
}

export async function saveOfficialCalendar(data: Partial<OfficialAcademicCalendarDto>): Promise<OfficialAcademicCalendarDto> {
  const res = await apiFetch<OfficialAcademicCalendarDto>('/api/v2/master/referentiels/calendar', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function toggleOfficialCalendarActive(id: string): Promise<OfficialAcademicCalendarDto> {
  const res = await apiFetch<OfficialAcademicCalendarDto>(`/api/v2/master/referentiels/calendar/${id}/toggle`, {
    method: 'PATCH',
  })
  return res.data!
}

export async function fetchBacCoefficients(params?: { serie?: string; niveau?: string; templateCode?: string; search?: string }): Promise<BacCoefficientDto[]> {
  const query = new URLSearchParams()
  if (params?.serie) query.set('serie', params.serie)
  if (params?.niveau) query.set('niveau', params.niveau)
  if (params?.templateCode) query.set('templateCode', params.templateCode)
  if (params?.search) query.set('search', params.search)
  const qs = query.toString()
  const res = await apiFetch<BacCoefficientDto[]>(`/api/v2/master/referentiels/bac-coefficients${qs ? `?${qs}` : ''}`)
  return res.data ?? []
}

export async function saveBacCoefficient(data: Partial<BacCoefficientDto>): Promise<BacCoefficientDto> {
  const res = await apiFetch<BacCoefficientDto>('/api/v2/master/referentiels/bac-coefficients', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function deleteBacCoefficient(id: string): Promise<void> {
  await apiFetch(`/api/v2/master/referentiels/bac-coefficients/${id}`, { method: 'DELETE' })
}

export async function fetchTemplateSubjects(params?: { templateCode?: string; classLevel?: string; filiere?: string; search?: string; subsystem?: 'FRANCOPHONE' | 'ANGLOPHONE' }): Promise<{ data: TemplateSubjectDto[]; subsystem: string }> {
  const query = new URLSearchParams()
  if (params?.templateCode) query.set('templateCode', params.templateCode)
  if (params?.classLevel) query.set('classLevel', params.classLevel)
  if (params?.filiere) query.set('filiere', params.filiere)
  if (params?.search) query.set('search', params.search)
  if (params?.subsystem) query.set('subsystem', params.subsystem)
  const qs = query.toString()
  const res = await apiFetch<TemplateSubjectDto[]>(`/api/v2/master/referentiels/template-subjects${qs ? `?${qs}` : ''}`)
  return { data: res.data ?? [], subsystem: (res as unknown as { subsystem?: string }).subsystem ?? 'FRANCOPHONE' }
}

export async function saveTemplateSubject(data: Partial<TemplateSubjectDto> & { subsystem?: 'FRANCOPHONE' | 'ANGLOPHONE' }): Promise<TemplateSubjectDto> {
  const res = await apiFetch<TemplateSubjectDto>('/api/v2/master/referentiels/template-subjects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function deleteTemplateSubject(id: string, subsystem: 'FRANCOPHONE' | 'ANGLOPHONE' = 'FRANCOPHONE'): Promise<void> {
  await apiFetch(`/api/v2/master/referentiels/template-subjects/${id}?subsystem=${subsystem}`, { method: 'DELETE' })
}

export async function fetchOfficialProgressions(params?: { templateCode?: string; level?: string; search?: string }): Promise<OfficialProgressionDto[]> {
  const query = new URLSearchParams()
  if (params?.templateCode) query.set('templateCode', params.templateCode)
  if (params?.level) query.set('level', params.level)
  if (params?.search) query.set('search', params.search)
  const qs = query.toString()
  const res = await apiFetch<OfficialProgressionDto[]>(`/api/v2/master/referentiels/progressions${qs ? `?${qs}` : ''}`)
  return res.data ?? []
}

export async function saveOfficialProgression(data: Partial<OfficialProgressionDto>): Promise<OfficialProgressionDto> {
  const res = await apiFetch<OfficialProgressionDto>('/api/v2/master/referentiels/progressions', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function deleteOfficialProgression(id: string): Promise<void> {
  await apiFetch(`/api/v2/master/referentiels/progressions/${id}`, { method: 'DELETE' })
}

export async function fetchTarifsMinesec(params?: { anneeScolaire?: string; typeFrais?: string }): Promise<TarifMinesecDto[]> {
  const query = new URLSearchParams()
  if (params?.anneeScolaire) query.set('anneeScolaire', params.anneeScolaire)
  if (params?.typeFrais) query.set('typeFrais', params.typeFrais)
  const qs = query.toString()
  const res = await apiFetch<TarifMinesecDto[]>(`/api/v2/master/referentiels/tarifs-minesec${qs ? `?${qs}` : ''}`)
  return res.data ?? []
}

export async function saveTarifMinesec(data: Partial<TarifMinesecDto>): Promise<TarifMinesecDto> {
  const res = await apiFetch<TarifMinesecDto>('/api/v2/master/referentiels/tarifs-minesec', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return res.data!
}

export async function toggleTarifMinesecActive(id: string): Promise<TarifMinesecDto> {
  const res = await apiFetch<TarifMinesecDto>(`/api/v2/master/referentiels/tarifs-minesec/${id}/toggle`, {
    method: 'PATCH',
  })
  return res.data!
}

export async function logout(): Promise<void> {
  await apiFetch('/api/v2/master/auth/logout', { method: 'POST' })
}

