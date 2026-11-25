import type { TemplateCatalogEntry, TemplateSubsystem, TemplateEducationType, TemplateLevel } from './templateCatalogTypes';
import type { Phase1Profile } from './phase1Profile';
import { resolveTemplateCandidates } from './resolveTemplateCandidates';

export function templateDisplayName(
  template: TemplateCatalogEntry,
  lang: 'fr' | 'en',
): string {
  if (template.langMode === 'bilingual' || template.isComplexe) {
    if (lang === 'en') return template.nameEn ?? template.name;
    return template.nameFr ?? template.name;
  }
  return template.name;
}

export function filterTemplates(
  catalog: TemplateCatalogEntry[],
  filters: {
    subsystem: TemplateSubsystem | null;
    educationType: TemplateEducationType | null;
    level: TemplateLevel | null;
    ownership: 'PUBLIC' | 'PRIVATE_SECULAR' | 'PRIVATE_FAITH' | null;
  },
): TemplateCatalogEntry[] {
  return catalog.filter((t) => {
    if (filters.subsystem && t.subsystem !== filters.subsystem) return false;
    if (filters.educationType && t.educationType !== filters.educationType) return false;
    if (filters.level && t.level !== filters.level) return false;
    if (filters.ownership) {
      if (t.ownershipHint !== null && !t.ownershipHint.includes(filters.ownership)) return false;
    }
    return true;
  });
}

export function pickEffectiveTemplateCode(
  selected: string | null,
  detected: string | null,
): string | null {
  return selected ?? detected;
}

export function suggestTemplateCode(
  profile: Phase1Profile,
  catalog: TemplateCatalogEntry[],
): string | null {
  return resolveTemplateCandidates(catalog, profile)[0]?.code ?? null;
}

// Pure detection — même heuristique que page.tsx, retourne code seul
export function detectTemplateCode(form: { subsystem: string; educationType: string; ownership: string; nom: string }): string | null {
  const { subsystem, educationType, ownership, nom } = form;
  const n = nom.toLowerCase();

  if (subsystem === 'FRANCOPHONE' && educationType === 'GENERAL') {
    if (ownership === 'PUBLIC') {
      if (n.includes('maternelle')) return 'MATERNELLE_FR';
      if (n.includes('primaire') || (n.includes('école') && !n.includes('lycée') && !n.includes('collège'))) return 'PRIMAIRE_FR';
      const isLycee = n.includes('lycée') || n.includes('lycee');
      const isCollege = n.includes('collège') || n.includes('college') || n.includes('ces');
      if (isCollege && !isLycee) return 'CES_FR';
      return 'LYCEE_FR';
    }
    return 'PRIVE_FR';
  }

  if (subsystem === 'FRANCOPHONE' && educationType === 'TECHNICAL') {
    const isCetic = n.includes('cetic') || n.includes('college') || n.includes('cet');
    if (isCetic) return 'CETIC';
    return 'LYCEE_TECHNIQUE_FR';
  }

  if (subsystem === 'FRANCOPHONE' && educationType === 'PROFESSIONAL') {
    if (n.includes('cfm') || n.includes('centre de forma')) return 'CFM';
    return 'SAR_SM';
  }

  if (subsystem === 'ANGLOPHONE' && educationType === 'TECHNICAL') {
    const isGtcOnly = n.includes('gtc') && !n.includes('high school') && !n.includes('gths');
    if (isGtcOnly) return 'GTC_EN';
    return 'GTC_GTHS_EN';
  }

  if (subsystem === 'ANGLOPHONE' && educationType === 'GENERAL') {
    if (n.includes('nursery') || n.includes('preschool')) return 'NURSERY_EN';
    if (n.includes('primary') || n.includes('nurs') || n.includes('infant') || (n.includes('junior') && !n.includes('secondary') && !n.includes('high') && !n.includes('grammar'))) return 'PRIMARY_EN';
    if (ownership === 'PRIVATE_SECULAR' || ownership === 'PRIVATE_FAITH') return 'PRIVE_EN';
    const isHigh = n.includes('high') || n.includes('grammar');
    return isHigh ? 'GHS_EN' : 'GSS_EN';
  }

  if (subsystem === 'BILINGUAL' && educationType === 'GENERAL') {
    if (n.includes('primaire') || n.includes('primary') || n.includes('nursery')) return 'PRIMARY_BILINGUAL';
    return 'LYCEE_BILINGUE';
  }

  if (subsystem === 'BILINGUAL' && educationType === 'MIXED') {
    return 'COMPLEXE_SCOLAIRE';
  }

  return null;
}

// Legacy helper — garde compatibilité si page veut l'objet complet
export function detectTemplate(form: { subsystem: string; educationType: string; ownership: string; nom: string }, catalog: TemplateCatalogEntry[]): TemplateCatalogEntry | null {
  const code = detectTemplateCode(form);
  if (!code) return null;
  return catalog.find((t) => t.code === code) ?? null;
}
