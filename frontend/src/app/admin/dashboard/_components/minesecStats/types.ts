export interface InfrastructuresDetailMap {
  commodites?: Record<string, boolean | null>
  [subsystem: string]: Record<string, Record<string, number | null | undefined> | undefined> | Record<string, boolean | null> | undefined
}

export interface EstpEntry {
  specialiteAcronyme: string
  anneeEtude: string
  divisions: number
  fillesTotal: number
  garconsTotal: number
  fillesRedoublants: number
  garconsRedoublants: number
}

export interface Supplement {
  hasTitreFoncier: boolean | null
  siteProvisoire: boolean | null
  distanceEtablissementProchePublic: number | null
  superficieTerrainM2: number | null
  superficieExtensionM2: number | null
  natureVoiesAcces: string | null
  nombreCycles: number | null
  hasInternat: boolean | null
  placesInternatFilles: number | null
  placesInternatGarcons: number | null
  ecolesPrimairesProximite: { moins1km?: number; entre1et3km?: number; entre4et5km?: number; plus5km?: number } | null
  posteComptable: string | null
  historiqueBip: { designation: string; anneeObtention: string }[] | null
  infrastructuresDetail: InfrastructuresDetailMap | null
  effectifsTechniquesDetail: EstpEntry[] | null
  lastUpdatedAt: string | null
}

export interface ChampManquant { champ: string; label: string }
export interface ChampNonResolu { fieldCode: string; sheetName: string; cellReference: string; fieldLabel: string; raison: string }
export interface Submission { id: string; status: string; generatedAt: string; filePath: string | null }
export interface InfraRow { code: string; label: string; row: number }
export interface InfraBreakdownKey { key: string; label: string }

export interface Meta {
  infraRows: InfraRow[]
  infraBreakdownKeys: InfraBreakdownKey[]
  commoditesRows: InfraRow[]
  subsystems: { code: string; label: string }[]
  specialitesTechniques: { acronyme: string; designationFr: string }[]
  anneesEtudeEstp: { anneeEtude: string; capaciteMax: number }[]
}

export const btnPri = { padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' as const }
export const btnSec = { padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 12.5, cursor: 'pointer' as const }
export const btnSmall = { padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', fontWeight: 600, fontSize: 11.5, cursor: 'pointer' as const }
export const inputStyle = { padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 12.5, width: '100%', boxSizing: 'border-box' as const }
export const smallInputStyle = { ...inputStyle, padding: '4px 8px', fontSize: 11.5 }
export const cardStyleCls = 'rounded-[12px] p-[12px] md:p-[16px] mb-[10px] md:mb-[14px] shadow-[0_1px_2px_rgba(20,20,15,0.05)] border border-[var(--border)]'
export const cardStyle = { background: 'var(--surface)' }
