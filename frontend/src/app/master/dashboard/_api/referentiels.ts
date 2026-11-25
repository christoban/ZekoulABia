import { apiFetch } from './client'

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

export interface OfficialProgressionChapterDto {
  ordre: number
  titre: string
  volumeHeuresPrevu?: number | null
  sequenceCibleFin?: number | null
  moduleOrdre?: number | null
  moduleTitre?: string | null
  leconNumero?: number | string | null
  numeroAffiche?: string | null
  positionDansModule?: number | null
  positionSource?: number | null
  sourceUrl?: string | null
}

export interface OfficialProgressionDto {
  id: string
  templateCode: string
  level: string
  filiere: string
  subjectName: string
  titre: string
  chapitres: OfficialProgressionChapterDto[]
  source?: string | null
  manuallyEdited?: boolean
  importChecksum?: string | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface ImportProgressionActionDto {
  index: number
  action: 'CREATE' | 'UPDATE' | 'UNCHANGED' | 'CONFLICT_MANUAL'
  cleProgression: string
  existingId: string | null
  existingUpdatedAt: string | null
  templateCode: string
  level: string
  filiere: string
  subjectName: string
  subjectNameSource: string | null
  titre: string
  source: string
  active: boolean
  manuallyEdited: boolean
  nbChapitresRetenus: number
  nbChapitresExclus: number
  importChecksum: string
}

export interface ImportProgressionRejectionDto {
  index: number
  templateCode: string
  level: string
  filiere: string
  subjectName: string
  subjectNameSource: string | null
  code: string
  message: string
}

export interface ImportProgressionDiagnosticsDto {
  leconsSansNumero: Array<{
    cleProgression: string
    subjectName: string
    moduleOrdre: number | null
    moduleTitre: string | null
    positionDansModule: number
    positionSource: number
    titre: string
    numeroAffiche: string | null
  }>
  numerosDupliques: Array<{
    cleProgression: string
    subjectName: string
    leconNumero: string
    portee: 'MEME_MODULE' | 'INTER_MODULES' | 'MIXTE'
    occurrences: Array<{
      moduleOrdre: number | null
      moduleTitre: string | null
      positionDansModule: number
      positionSource: number
      titre: string
      numeroAffiche: string | null
    }>
  }>
  modulesParasites: Array<{
    cleProgression: string
    subjectName: string
    moduleOrdre: number | null
    moduleTitre: string | null
    nbLecons: number
  }>
  elementsExclus: Array<{
    cleProgression: string
    subjectName: string
    moduleOrdre: number | null
    moduleTitre: string | null
    positionDansModule: number
    positionSource: number
    titre: string
    leconNumero: number | string | null
    numeroAffiche: string | null
  }>
}

export interface ImportProgressionDryRunDto {
  dryRun: true
  level: string | null
  source: string
  peutAppliquer: boolean
  resume: {
    totalItems: number
    valides: number
    aCreer: number
    aMettreAJour: number
    inchanges: number
    conflitsManuels: number
    rejetes: number
    leconsRetenues: number
    leconsExclues: number
  }
  actions: ImportProgressionActionDto[]
  conflitsManuels: ImportProgressionActionDto[]
  rejets: ImportProgressionRejectionDto[]
  diagnostics: ImportProgressionDiagnosticsDto
}

export interface ImportProgressionApplyResultDto {
  applied: true
  level: string
  source: string
  createdCount: number
  updatedCount: number
  overwrittenManualCount: number
  unchangedCount: number
  skippedManualCount: number
  totalAffected: number
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

export async function proposeOfficialProgressionsImport(
  payload: Record<string, unknown>,
): Promise<ImportProgressionDryRunDto> {
  const res = await apiFetch<ImportProgressionDryRunDto>(
    '/api/v2/master/referentiels/progressions/import/propose',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return res.data!
}

export async function applyOfficialProgressionsImport(
  payload: Record<string, unknown>,
): Promise<ImportProgressionApplyResultDto> {
  const res = await apiFetch<ImportProgressionApplyResultDto>(
    '/api/v2/master/referentiels/progressions/import/apply',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    },
  )
  return res.data!
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
