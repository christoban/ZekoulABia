import { ApiError, apiFetch } from './client'

export interface AtelierSchoolInfoDto {
  id: string
  name: string
  subdomain: string
  subsystem?: string | null
  educationType?: string | null
  city?: string | null
  phone?: string | null
  logoUrl?: string | null
}

export interface AtelierSchoolConfigDto {
  bulletinTemplate?: string | null
  bulletinGroupingScheme?: string | null
  useMeasuredBulletinRenderer?: boolean
}

export interface AtelierIdentityKitDto {
  id?: string
  schoolId: string
  regionalDelegationFr: string | null
  regionalDelegationEn: string | null
  departmentalDelegationFr: string | null
  departmentalDelegationEn: string | null
  mottoFr: string | null
  mottoEn: string | null
  poBox: string | null
  city: string | null
  phone: string | null
  foundingYear: number | null
  authorizationNumber: string | null
  accentColor: string | null
  logoAssetKey: string | null
  coatOfArmsAssetKey: string | null
  stampAssetKey: string | null
  principalSignatureAssetKey: string | null
  censorSignatureAssetKey: string | null
  useCoatOfArms: boolean
}

export interface AtelierCatalogSpecDto {
  id: string
  familyKey: 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
  targetTemplate?: string
  layoutVariant?: string
  calculationMode?: string
  showGroupRankInSubtotal?: boolean
  validationNotice?: string
  name: string
  version: number
  status?: 'DRAFT' | 'PUBLISHED'
  defaultGroupingScheme?: string
  language: 'fr' | 'en' | 'bilingual'
  blocks: Array<{ type: string; [key: string]: unknown }>
}

export interface AtelierAssignmentDto {
  id: string
  schoolId: string
  classLevel: string | null
  classId: string | null
  periodKind: 'SEQUENCE' | 'TRIMESTER' | 'ANNUAL' | 'MONTHLY'
  template: string
  templateSpecId: string
  templateVersion: number
  groupingScheme: string | null
  isActive: boolean
}

export interface AtelierStateDto {
  school: AtelierSchoolInfoDto
  schoolConfig: AtelierSchoolConfigDto
  identityKit: AtelierIdentityKitDto | null
  assignments: AtelierAssignmentDto[]
  catalogSpecs: AtelierCatalogSpecDto[]
  classes: Array<{ id: string; name: string; level: string | null }>
  knownClassLevels: string[]
  canEdit: boolean
}

export async function fetchAtelierState(schoolId: string): Promise<AtelierStateDto> {
  const res = await apiFetch<AtelierStateDto>(`/api/v2/master/bulletin-atelier/schools/${schoolId}`)
  return res.data!
}

export async function saveAtelierIdentityKit(
  schoolId: string,
  payload: Partial<AtelierIdentityKitDto> & AtelierSchoolConfigDto,
): Promise<{ identityKit: AtelierIdentityKitDto; schoolConfig: AtelierSchoolConfigDto }> {
  const res = await apiFetch<{ identityKit: AtelierIdentityKitDto; schoolConfig: AtelierSchoolConfigDto }>(
    `/api/v2/master/bulletin-atelier/schools/${schoolId}/identity-kit`,
    { method: 'PUT', body: JSON.stringify(payload) },
  )
  return res.data!
}

export async function uploadAtelierAsset(
  schoolId: string,
  assetType: 'logo' | 'coatOfArms' | 'stamp' | 'principalSignature' | 'censorSignature',
  dataUri: string,
): Promise<{ identityKit: AtelierIdentityKitDto }> {
  const res = await apiFetch<{ identityKit: AtelierIdentityKitDto }>(
    `/api/v2/master/bulletin-atelier/schools/${schoolId}/identity-kit/assets/${assetType}`,
    { method: 'POST', body: JSON.stringify({ dataUri }) },
  )
  return res.data!
}

export async function createAtelierSpecVersion(
  schoolId: string,
  payload: {
    baseSpecId: string
    baseVersion: number
    name?: string
    language?: 'fr' | 'en' | 'bilingual'
    defaultGroupingScheme?: string
    periodLabelMode?: string
    appreciationScale?: string
    showGroupRankInSubtotal?: boolean
    councilItems?: string[]
    publish: boolean
  },
): Promise<{ spec: AtelierCatalogSpecDto; catalogSpecs: AtelierCatalogSpecDto[] }> {
  const res = await apiFetch<{ spec: AtelierCatalogSpecDto; catalogSpecs: AtelierCatalogSpecDto[] }>(
    `/api/v2/master/bulletin-atelier/schools/${schoolId}/specs/version`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
  return res.data!
}

export async function saveAtelierAssignment(
  schoolId: string,
  payload: {
    classLevel?: string | null
    classId?: string | null
    periodKind: 'SEQUENCE' | 'TRIMESTER' | 'ANNUAL' | 'MONTHLY'
    template?: string
    templateSpecId: string
    templateVersion: number
    groupingScheme?: string | null
  },
): Promise<{ assignment: AtelierAssignmentDto }> {
  const res = await apiFetch<{ assignment: AtelierAssignmentDto }>(
    `/api/v2/master/bulletin-atelier/schools/${schoolId}/assignments`,
    { method: 'POST', body: JSON.stringify(payload) },
  )
  return res.data!
}

export async function deleteAtelierAssignment(schoolId: string, assignmentId: string): Promise<void> {
  await apiFetch(`/api/v2/master/bulletin-atelier/schools/${schoolId}/assignments/${assignmentId}`, {
    method: 'DELETE',
  })
}

export async function fetchAtelierPreviewPdfBlob(
  schoolId: string,
  payload: {
    templateSpecId: string
    templateVersion: number
    draftOverrides?: Record<string, unknown>
    kitOverrides?: Record<string, unknown>
  },
): Promise<Blob> {
  const res = await fetch(`/api/v2/master/bulletin-atelier/schools/${schoolId}/preview-pdf`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Erreur aperçu PDF' }))
    throw new ApiError(err.message || 'Erreur aperçu PDF', res.status)
  }
  return res.blob()
}

