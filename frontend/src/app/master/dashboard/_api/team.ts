import { apiFetch } from './client'

// ─── ÉQUIPE MASTER (GESTION DES OPÉRATEURS PLATEFORME) ──────────────────────

export type MasterTeamRole = 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'SCHOOL_MANAGER' | 'SUPPORT'

export interface MasterTeamMemberDto {
  id: string
  email: string
  name: string
  role: MasterTeamRole
  isSuperAdmin: boolean
  isOwner: boolean
  isActive: boolean
  assignedSchoolIds: string[]
  lastLoginAt?: string | null
  createdAt: string
  createdSchoolsCount: number
}

export async function fetchMasterTeam(): Promise<MasterTeamMemberDto[]> {
  const res = await apiFetch<MasterTeamMemberDto[]>('/api/v2/master/team')
  return res.data ?? []
}

export async function createMasterTeamMember(body: {
  email: string
  name: string
  role: MasterTeamRole
  assignedSchoolIds?: string[]
}): Promise<{ member: MasterTeamMemberDto; temporaryPassword: string; emailSent?: boolean }> {
  const res = await apiFetch<{ member: MasterTeamMemberDto; temporaryPassword: string; emailSent?: boolean }>('/api/v2/master/team', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!res.data) throw new Error('Erreur lors de la création du membre')
  return res.data
}

export async function updateMasterTeamMember(
  id: string,
  body: {
    name?: string
    role?: MasterTeamRole
    isActive?: boolean
    assignedSchoolIds?: string[]
  },
): Promise<MasterTeamMemberDto> {
  const res = await apiFetch<MasterTeamMemberDto>(`/api/v2/master/team/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
  if (!res.data) throw new Error('Erreur lors de la mise à jour du membre')
  return res.data
}

export async function resetMasterTeamMemberPassword(
  id: string,
): Promise<{ member: MasterTeamMemberDto; temporaryPassword: string; emailSent?: boolean }> {
  const res = await apiFetch<{ member: MasterTeamMemberDto; temporaryPassword: string; emailSent?: boolean }>(
    `/api/v2/master/team/${id}/reset-password`,
    { method: 'POST', body: '{}' },
  )
  if (!res.data) throw new Error('Erreur lors de la réinitialisation du mot de passe')
  return res.data
}

export async function deleteMasterTeamMember(id: string): Promise<void> {
  await apiFetch(`/api/v2/master/team/${id}`, {
    method: 'DELETE',
  })
}
