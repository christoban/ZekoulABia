import { apiFetch } from './_api/client'

export { ApiError } from './_api/client'

export {
  type MasterUserDto,
  fetchMe,
  fetchMasterMfaStatus,
  mfaSetup,
  mfaEnable,
  mfaDisable,
  mfaRegenCodes,
  resetUserMfa,
  initiatePasswordChange,
  changePassword,
  logout,
} from './_api/auth'

export {
  type SchoolDto,
  type SchoolDetailDto,
  fetchSchools,
  fetchSchoolDetail,
  inviteSchool,
  suspendSchool,
  reactivateSchool,
  rejectSchool,
  approveSchool,
  changeSchoolPlan,
  cancelApproval,
  reexamineSchool,
  resendInvite,
  deleteSchool,
} from './_api/schools'

export {
  type AuditLogDto,
  type EmailLogDto,
  type AIActionAuditLogDto,
  fetchLogs,
  fetchEmailLogs,
  fetchAIActionAuditLog,
} from './_api/logs'

export {
  type ReferentielsSummaryDto,
  type OfficialAcademicCalendarDto,
  type BacCoefficientDto,
  type TemplateSubjectDto,
  type OfficialProgressionChapterDto,
  type OfficialProgressionDto,
  type ImportProgressionActionDto,
  type ImportProgressionRejectionDto,
  type ImportProgressionDiagnosticsDto,
  type ImportProgressionDryRunDto,
  type ImportProgressionApplyResultDto,
  type TarifMinesecDto,
  fetchReferentielsSummary,
  fetchOfficialCalendars,
  saveOfficialCalendar,
  toggleOfficialCalendarActive,
  fetchBacCoefficients,
  saveBacCoefficient,
  deleteBacCoefficient,
  fetchTemplateSubjects,
  saveTemplateSubject,
  deleteTemplateSubject,
  fetchOfficialProgressions,
  saveOfficialProgression,
  deleteOfficialProgression,
  proposeOfficialProgressionsImport,
  applyOfficialProgressionsImport,
  fetchTarifsMinesec,
  saveTarifMinesec,
  toggleTarifMinesecActive,
} from './_api/referentiels'

export {
  type MasterTeamRole,
  type MasterTeamMemberDto,
  fetchMasterTeam,
  createMasterTeamMember,
  updateMasterTeamMember,
  resetMasterTeamMemberPassword,
  deleteMasterTeamMember,
} from './_api/team'

// ─── MODE TEST (RÉGLAGE PLATEFORME ENVOIS SORTANTS) ────────────────────────

export interface PlatformSettingsDto {
  outboundMessagingEnabled: boolean
  disabledSchoolIds?: string[]
}

export interface SuppressedOutboundMessageDto {
  id: string
  channel: string
  eventType: string
  recipientMasked: string
  schoolId?: string | null
  createdAt: string
}

export async function fetchPlatformSettings(): Promise<PlatformSettingsDto> {
  const res = await apiFetch<PlatformSettingsDto>('/api/v2/master/platform-settings')
  if (!res.data) throw new Error('Réglages plateforme introuvables')
  return res.data
}

export async function updatePlatformSettings(
  outboundMessagingEnabled: boolean,
  schoolId?: string | null,
): Promise<PlatformSettingsDto> {
  const res = await apiFetch<PlatformSettingsDto>('/api/v2/master/platform-settings', {
    method: 'PATCH',
    body: JSON.stringify(schoolId ? { outboundMessagingEnabled, schoolId } : { outboundMessagingEnabled }),
  })
  if (!res.data) throw new Error('Erreur lors de la mise à jour du mode test')
  return res.data
}

export async function fetchSuppressedOutboundMessages(
  limit = 100,
  schoolId?: string | null,
): Promise<SuppressedOutboundMessageDto[]> {
  const params = new URLSearchParams({ limit: String(limit) })
  if (schoolId) params.set('schoolId', schoolId)
  const res = await apiFetch<SuppressedOutboundMessageDto[]>(`/api/v2/master/platform-settings/messages-supprimes?${params}`)
  return res.data ?? []
}
