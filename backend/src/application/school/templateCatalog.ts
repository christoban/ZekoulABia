import { getTemplateMeta } from './schoolTemplateConfig';

export type TemplateSubsystem = 'FRANCOPHONE' | 'ANGLOPHONE' | 'BILINGUAL';
export type TemplateEducationType = 'GENERAL' | 'TECHNICAL' | 'PROFESSIONAL' | 'MIXED';
export type TemplateLevel = 'PRIMARY' | 'SECONDARY' | 'COMPLEX';

export interface TemplateCatalogEntry {
  code: string;
  name: string;
  nameFr?: string;
  nameEn?: string;
  subsystem: TemplateSubsystem;
  educationType: TemplateEducationType;
  level: TemplateLevel;
  hasPremierCycle: boolean;
  hasDeuxiemeCycle: boolean;
  isTechnique: boolean;
  isPrimaire: boolean;
  isComplexe: boolean;
  langMode: 'francophone' | 'anglophone' | 'bilingual';
  ownershipHint: Array<'PUBLIC' | 'PRIVATE_SECULAR' | 'PRIVATE_FAITH'> | null;
}

function buildEntry(
  code: string,
  name: string,
  subsystem: TemplateSubsystem,
  educationType: TemplateEducationType,
  level: TemplateLevel,
  hasPremierCycle: boolean,
  hasDeuxiemeCycle: boolean,
  isComplexe: boolean,
  ownershipHint: TemplateCatalogEntry['ownershipHint'],
): TemplateCatalogEntry {
  const meta = getTemplateMeta(code);
  return {
    code,
    name,
    subsystem,
    educationType,
    level,
    hasPremierCycle,
    hasDeuxiemeCycle,
    isTechnique: meta.isTechnique,
    isPrimaire: meta.isPrimaire,
    isComplexe,
    langMode: meta.langMode,
    ownershipHint,
  };
}

const CATALOG: TemplateCatalogEntry[] = [
  buildEntry('GHS_EN', 'Government High School', 'ANGLOPHONE', 'GENERAL', 'SECONDARY', true, true, false, null),
  buildEntry('GSS_EN', 'Government Secondary School', 'ANGLOPHONE', 'GENERAL', 'SECONDARY', true, false, false, null),
  buildEntry('PRIVE_EN', 'Private School (Anglophone)', 'ANGLOPHONE', 'GENERAL', 'SECONDARY', true, true, false, ['PRIVATE_SECULAR', 'PRIVATE_FAITH']),
  buildEntry('PRIMARY_EN', 'Primary School (Anglophone)', 'ANGLOPHONE', 'GENERAL', 'PRIMARY', false, false, false, null),
  buildEntry('NURSERY_EN', 'Nursery School', 'ANGLOPHONE', 'GENERAL', 'PRIMARY', false, false, false, null),
  buildEntry('GTC_GTHS_EN', 'Government Technical College & High School', 'ANGLOPHONE', 'TECHNICAL', 'SECONDARY', true, true, false, null),
  buildEntry('GTC_EN', 'Government Technical College', 'ANGLOPHONE', 'TECHNICAL', 'SECONDARY', true, false, false, null),
  { ...buildEntry('LYCEE_BILINGUE', 'Lycée Bilingue', 'BILINGUAL', 'GENERAL', 'SECONDARY', true, true, false, null), nameFr: 'Lycée Bilingue', nameEn: 'Government Bilingual High School' },
  { ...buildEntry('PRIMARY_BILINGUAL', 'Primary School Bilingue', 'BILINGUAL', 'GENERAL', 'PRIMARY', false, false, false, null), nameFr: 'École Primaire Bilingue', nameEn: 'Bilingual Primary School' },
  buildEntry('LYCEE_TECHNIQUE_FR', 'Lycée Technique Francophone', 'FRANCOPHONE', 'TECHNICAL', 'SECONDARY', true, true, false, null),
  buildEntry('CETIC', "Collège d'Enseignement Technique", 'FRANCOPHONE', 'TECHNICAL', 'SECONDARY', true, false, false, null),
  buildEntry('SAR_SM', 'SAR / Section Ménagère', 'FRANCOPHONE', 'PROFESSIONAL', 'SECONDARY', false, false, false, null),
  buildEntry('CFM', 'Centre de Formation aux Métiers', 'FRANCOPHONE', 'PROFESSIONAL', 'SECONDARY', false, false, false, null),
  buildEntry('PRIMAIRE_FR', 'École Primaire Francophone', 'FRANCOPHONE', 'GENERAL', 'PRIMARY', false, false, false, null),
  buildEntry('MATERNELLE_FR', 'École Maternelle', 'FRANCOPHONE', 'GENERAL', 'PRIMARY', false, false, false, null),
  buildEntry('LYCEE_FR', 'Lycée Général Francophone', 'FRANCOPHONE', 'GENERAL', 'SECONDARY', true, true, false, null),
  buildEntry('CES_FR', "Collège d'Enseignement Secondaire", 'FRANCOPHONE', 'GENERAL', 'SECONDARY', true, false, false, null),
  buildEntry('PRIVE_FR', 'Établissement Privé Francophone', 'FRANCOPHONE', 'GENERAL', 'SECONDARY', true, true, false, ['PRIVATE_SECULAR', 'PRIVATE_FAITH']),
  { ...buildEntry('COMPLEXE_SCOLAIRE', 'Complexe Scolaire', 'FRANCOPHONE', 'MIXED', 'COMPLEX', true, true, true, null), nameFr: 'Complexe Scolaire', nameEn: 'School Complex' },
];

export function listTemplateCatalog(): TemplateCatalogEntry[] {
  return [...CATALOG];
}

export function findTemplateInCatalog(code: string): TemplateCatalogEntry | undefined {
  return CATALOG.find((e) => e.code === code);
}

export function assertKnownTemplateCode(code: string): void {
  if (!findTemplateInCatalog(code)) {
    throw new Error(
      `Template inconnu ou non supporté : ${code}. Utilisez un code du catalogue officiel.`,
    );
  }
}
