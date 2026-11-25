export type SchoolStructure = 'MONO' | 'COMPLEX'
export type LevelFamily = 'MATERNELLE_NURSERY' | 'PRIMARY' | 'SECONDARY'
export type OfferFlag = 'GENERAL' | 'TECHNICAL' | 'PROFESSIONAL'
export type SecondarySpan =
  | 'TO_3E'
  | 'TO_TLE'
  | 'TO_FORM5'
  | 'TO_UPPER_SIXTH'
  | 'TECH_1ER'
  | 'TECH_FULL'
  | 'PRO_SAR'
  | 'PRO_CFM'
  | null

export interface Phase1Profile {
  subsystem: 'FRANCOPHONE' | 'ANGLOPHONE' | 'BILINGUAL' | null
  structure: SchoolStructure | null
  levelFamily: LevelFamily | null
  offers: OfferFlag[]
  secondarySpan: SecondarySpan
  ownership: 'PUBLIC' | 'PRIVATE_SECULAR' | 'PRIVATE_FAITH' | null
  selectedTemplateCode: string | null
}

export function deriveEducationType(
  offers: OfferFlag[],
): 'GENERAL' | 'TECHNICAL' | 'PROFESSIONAL' | 'MIXED' | null {
  if (offers.length === 0) return null
  if (offers.length > 1) return 'MIXED'
  return offers[0]
}
