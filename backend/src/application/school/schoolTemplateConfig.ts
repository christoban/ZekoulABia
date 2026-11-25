import type { TemplateMeta } from '@domain/types/enums';
export type { TemplateMeta };

const TEMPLATE_CONFIG: Record<string, TemplateMeta> = {
  GHS_EN:            { isAnglophone: true,  isPrimaire: false, isTechnique: false, langMode: 'anglophone' },
  GSS_EN:            { isAnglophone: true,  isPrimaire: false, isTechnique: false, langMode: 'anglophone' },
  PRIVE_EN:          { isAnglophone: true,  isPrimaire: false, isTechnique: false, langMode: 'anglophone' },
  PRIMARY_EN:        { isAnglophone: true,  isPrimaire: true,  isTechnique: false, langMode: 'anglophone' },
  NURSERY_EN:        { isAnglophone: true,  isPrimaire: true,  isTechnique: false, langMode: 'anglophone' },
  GTC_GTHS_EN:       { isAnglophone: true,  isPrimaire: false, isTechnique: true,  langMode: 'anglophone' },
  GTC_EN:            { isAnglophone: true,  isPrimaire: false, isTechnique: true,  langMode: 'anglophone' },

  LYCEE_BILINGUE:    { isAnglophone: false, isPrimaire: false, isTechnique: false, langMode: 'bilingual' },
  PRIMARY_BILINGUAL: { isAnglophone: false, isPrimaire: true,  isTechnique: false, langMode: 'bilingual' },

  LYCEE_TECHNIQUE_FR: { isAnglophone: false, isPrimaire: false, isTechnique: true, langMode: 'francophone' },
  CETIC:              { isAnglophone: false, isPrimaire: false, isTechnique: true, langMode: 'francophone' },
  SAR_SM:             { isAnglophone: false, isPrimaire: false, isTechnique: true, langMode: 'francophone' },
  CFM:                { isAnglophone: false, isPrimaire: false, isTechnique: true, langMode: 'francophone' },

  PRIMAIRE_FR:        { isAnglophone: false, isPrimaire: true,  isTechnique: false, langMode: 'francophone' },
  MATERNELLE_FR:      { isAnglophone: false, isPrimaire: true,  isTechnique: false, langMode: 'francophone' },
  LYCEE_FR:           { isAnglophone: false, isPrimaire: false, isTechnique: false, langMode: 'francophone' },
  CES_FR:             { isAnglophone: false, isPrimaire: false, isTechnique: false, langMode: 'francophone' },
  PRIVE_FR:           { isAnglophone: false, isPrimaire: false, isTechnique: false, langMode: 'francophone' },
  COMPLEXE_SCOLAIRE:  { isAnglophone: false, isPrimaire: false, isTechnique: false, langMode: 'francophone' },
};

export function getTemplateMeta(templateCode: string | undefined | null): TemplateMeta {
  return TEMPLATE_CONFIG[templateCode ?? ''] ?? { isAnglophone: false, isPrimaire: false, isTechnique: false, langMode: 'francophone' };
}

// Templates éligibles au PEBS Francophone (secondaire général FR)
const PEBS_FR_TEMPLATES = new Set(['LYCEE_FR', 'CES_FR', 'PRIVE_FR', 'LYCEE_BILINGUE']);

// Templates éligibles au PEBS Anglophone (secondaire général EN)
const PEBS_EN_TEMPLATES = new Set(['GHS_EN', 'GSS_EN', 'PRIVE_EN', 'LYCEE_BILINGUE']);

export function isPEBSFrancophoneEligible(templateCode: string | undefined | null): boolean {
  return PEBS_FR_TEMPLATES.has(templateCode ?? '');
}

export function isPEBSAnglophoneEligible(templateCode: string | undefined | null): boolean {
  return PEBS_EN_TEMPLATES.has(templateCode ?? '');
}

export function hasSectionSecondaireGenerale(templateCode: string | undefined | null): boolean {
  const meta = getTemplateMeta(templateCode);
  return !meta.isPrimaire && !meta.isTechnique;
}
