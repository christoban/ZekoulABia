import { apiFetch } from './client'

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
  createdByMasterId?: string | null
  createdByMaster?: { id: string; name: string; email: string; role: string } | null
  invites?: { id: string; email: string; status: string; expiresAt: string; createdAt: string }[]
  users?: { email: string | null }[]
  _count?: { users: number; classes: number; subjects?: number; feePlans?: number }
  schoolConfig?: Record<string, unknown> | null
  schoolSettings?: Record<string, unknown> | null
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
}): Promise<{ id?: string; schoolId?: string | null; token?: string; activationUrl?: string } | undefined> {
  const res = await apiFetch<{ id?: string; schoolId?: string | null; token?: string; activationUrl?: string }>('/api/v2/master/schools/invite', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  return res.data
}

export async function suspendSchool(id: string, reason?: string, sensitiveAuth?: { password: string; code?: string }): Promise<void> {
  await apiFetch(`/api/v2/master/schools/${id}/suspend`, {
    method: 'POST',
    body: JSON.stringify({ reason: reason?.trim() || undefined, sensitiveAuth }),
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
