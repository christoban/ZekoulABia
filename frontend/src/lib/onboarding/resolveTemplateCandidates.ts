import type { TemplateCatalogEntry } from './templateCatalogTypes'
import type { OfferFlag, Phase1Profile, SecondarySpan } from './phase1Profile'

const PRIMARY_CODES = new Set(['PRIMAIRE_FR', 'PRIMARY_EN', 'PRIMARY_BILINGUAL'])
const MATERNELLE_CODES = new Set(['MATERNELLE_FR', 'NURSERY_EN'])
const SPAN_CODES: Record<Exclude<SecondarySpan, null>, string[]> = {
  TO_3E: ['CES_FR'],
  TO_TLE: ['LYCEE_FR'],
  TO_FORM5: ['GSS_EN'],
  TO_UPPER_SIXTH: ['GHS_EN'],
  TECH_1ER: ['CETIC', 'GTC_EN'],
  TECH_FULL: ['LYCEE_TECHNIQUE_FR', 'GTC_GTHS_EN'],
  PRO_SAR: ['SAR_SM'],
  PRO_CFM: ['CFM'],
}

function matchesOffer(entry: TemplateCatalogEntry, offers: OfferFlag[]): boolean {
  if (offers.length === 0) return false
  if (offers.length > 1) {
    return offers.includes(entry.educationType as OfferFlag) || entry.educationType === 'MIXED' || entry.isComplexe
  }
  return entry.educationType === offers[0]
}

export function resolveTemplateCandidates(
  catalog: TemplateCatalogEntry[],
  profile: Phase1Profile,
): TemplateCatalogEntry[] {
  if (profile.subsystem === null) return []

  let candidates = catalog.filter((entry) => entry.subsystem === profile.subsystem)

  if (profile.structure === 'COMPLEX') {
    return candidates.filter((entry) => entry.isComplexe)
  }
  if (profile.structure === 'MONO') {
    candidates = candidates.filter((entry) => !entry.isComplexe)
  }

  if (profile.offers.length === 0) return []
  candidates = candidates.filter((entry) => matchesOffer(entry, profile.offers))

  if (profile.levelFamily === 'MATERNELLE_NURSERY') {
    candidates = candidates.filter((entry) => MATERNELLE_CODES.has(entry.code))
  } else if (profile.levelFamily === 'PRIMARY') {
    candidates = candidates.filter((entry) => PRIMARY_CODES.has(entry.code))
  } else if (profile.levelFamily === 'SECONDARY') {
    candidates = candidates.filter((entry) => !entry.isPrimaire && !entry.isComplexe)
  }

  if (profile.secondarySpan !== null) {
    const spanCodes = new Set(SPAN_CODES[profile.secondarySpan])
    const spanCandidates = candidates.filter((entry) => spanCodes.has(entry.code))
    if (spanCandidates.length > 0) candidates = spanCandidates
  }

  const ownership = profile.ownership
  return [...candidates].sort((left, right) => {
    const spanRank = (entry: TemplateCatalogEntry): number => {
      if (profile.secondarySpan === null) return 0
      return SPAN_CODES[profile.secondarySpan].includes(entry.code) ? 0 : 1
    }
    const ownershipRank = (entry: TemplateCatalogEntry): number => {
      if (!ownership) return 0
      if (ownership === 'PUBLIC') return entry.ownershipHint?.includes('PUBLIC') ? 0 : entry.code.startsWith('PRIVE_') ? 1 : 0
      return entry.code.startsWith('PRIVE_') ? 0 : 1
    }
    return spanRank(left) - spanRank(right) || ownershipRank(left) - ownershipRank(right) || left.name.localeCompare(right.name)
  })
}
