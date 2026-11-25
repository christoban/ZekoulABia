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
