import type {
  BulletinGroupingScheme,
  BulletinPeriodKind,
  BulletinTemplate,
  EducationType,
  SchoolSubsystem,
} from '@domain/types/enums';
import { getPublishedTemplateSpec } from '@domain/templates/bulletinCatalog';

export type SectionCycle = 'maternelle' | 'primaire' | 'secondaire_1' | 'secondaire_2' | 'technique';
export type SubSystemCode = 'MATERNELLE' | 'FR_PRIMAIRE' | 'EN_PRIMAIRE' | 'FR_SECONDARY' | 'EN_SECONDARY';

/**
 * Valeurs canoniques de `Class.level` reconnues par le curriculum ZekoulABia.
 * Tout libellé libre hors de cette liste est rejeté à la création d'une affectation.
 */
export const KNOWN_CLASS_LEVELS: readonly string[] = [
  // Secondaire général francophone & anglophone
  '6e', '5e', '4e', '3e', '2nde', '1ere', '1ère', 'Tle', 'Terminale',
  'Form1', 'Form2', 'Form3', 'Form4', 'Form5', 'LowerSixth', 'UpperSixth',
  // Primaire francophone & anglophone
  'SIL', 'CP', 'CE1', 'CE2', 'CM1', 'CM2',
  'Class1', 'Class2', 'Class3', 'Class4', 'Class5', 'Class6',
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6',
  // Préscolaire / Maternelle
  'PS', 'MS', 'GS', 'Petite section', 'Moyenne section', 'Grande section',
  'Nursery1', 'Nursery2', 'Nursery 1', 'Nursery 2',
  // Technique & Professionnel
  '1ereAnnee', '2eAnnee', '3eAnnee', '4eAnnee', 'Année1', 'Année2', 'Annee1', 'Annee2',
  'CAP1', 'CAP2', 'CAP3', 'CAP4', 'BT1', 'BT2', 'BT3',
  '2ndeTech', '1ereTech', 'TleTech', 'IND', 'STT', 'G2', 'F1', 'SAR', 'SM', 'COUTURE',
] as const;

const KNOWN_CLASS_LEVEL_SET = new Set<string>(KNOWN_CLASS_LEVELS);

export function assertValidClassLevel(classLevel: string | null | undefined): string | null {
  if (classLevel === undefined || classLevel === null || classLevel === '') return null;
  if (!KNOWN_CLASS_LEVEL_SET.has(classLevel)) {
    throw new Error(
      `Niveau de classe invalide "${classLevel}" : doit correspondre à une valeur canonique de Class.level.`,
    );
  }
  return classLevel;
}

export interface BulletinTemplateAssignmentRule {
  id: string;
  schoolId: string;
  classLevel: string | null;
  classId: string | null;
  periodKind: BulletinPeriodKind;
  template: BulletinTemplate;
  templateSpecId: string;
  templateVersion: number;
  groupingScheme: BulletinGroupingScheme | null;
  isActive: boolean;
}

export interface ResolvedBulletinAssignment {
  template: BulletinTemplate;
  templateSpecId: string | null;
  templateVersion: number;
  groupingScheme: BulletinGroupingScheme;
  source: 'class_assignment' | 'level_assignment' | 'school_assignment' | 'school_config_fallback';
}

export function resolvePeriodKindFromName(periodName: string, requestedTemplate?: BulletinTemplate): BulletinPeriodKind {
  if (requestedTemplate === 'ANNUAL') return 'ANNUAL';
  if (requestedTemplate === 'MONTHLY') return 'MONTHLY';
  const low = periodName.toLowerCase();
  if (low.includes('annu')) return 'ANNUAL';
  if (low.includes('mensu') || low.includes('month')) return 'MONTHLY';
  if (low.includes('trim') || low.includes('term')) return 'TRIMESTER';
  return 'SEQUENCE';
}

/**
 * Résolution du modèle canonique Prisma (`BulletinTemplate`) depuis le profil d'établissement/classe.
 */
export function resolveBulletinTemplate(params: {
  explicitTemplate?: BulletinTemplate | null;
  schoolConfigTemplate?: BulletinTemplate | null;
  subsystem?: SchoolSubsystem | string | null;
  educationType?: EducationType | string | null;
  sectionCode?: string | null;
  periodKind?: BulletinPeriodKind;
  isPrimaryOrPreschool?: boolean;
}): BulletinTemplate {
  if (params.explicitTemplate) return params.explicitTemplate;
  if (params.periodKind === 'ANNUAL') return 'ANNUAL';
  if (params.periodKind === 'MONTHLY') return 'MONTHLY';
  if (params.schoolConfigTemplate) return params.schoolConfigTemplate;
  if (params.isPrimaryOrPreschool) return 'PRIMARY';
  if (params.educationType === 'TECHNICAL' || params.educationType === 'PROFESSIONAL') return 'TECHNICAL_FR';
  const sec = (params.sectionCode ?? '').toUpperCase();
  if (params.subsystem === 'ANGLOPHONE' || sec.startsWith('EN')) return 'EN_SECONDARY';
  return 'FR_SECONDARY';
}

export function resolveEffectiveTemplateAssignment(params: {
  assignments: BulletinTemplateAssignmentRule[];
  classId: string;
  classLevel: string | null;
  periodKind: BulletinPeriodKind;
  defaultTemplate: BulletinTemplate;
  defaultGroupingScheme: BulletinGroupingScheme;
}): ResolvedBulletinAssignment {
  const active = params.assignments.filter((a) => a.isActive && a.periodKind === params.periodKind);
  const byClass = active.find((a) => a.classId === params.classId);
  if (byClass) {
    const spec = getPublishedTemplateSpec(byClass.templateSpecId, byClass.templateVersion);
    return {
      template: byClass.template,
      templateSpecId: spec ? spec.id : null,
      templateVersion: byClass.templateVersion,
      groupingScheme: byClass.groupingScheme ?? spec?.defaultGroupingScheme ?? params.defaultGroupingScheme,
      source: 'class_assignment',
    };
  }

  const byLevel = params.classLevel
    ? active.find((a) => !a.classId && a.classLevel === params.classLevel)
    : undefined;
  if (byLevel) {
    const spec = getPublishedTemplateSpec(byLevel.templateSpecId, byLevel.templateVersion);
    return {
      template: byLevel.template,
      templateSpecId: spec ? spec.id : null,
      templateVersion: byLevel.templateVersion,
      groupingScheme: byLevel.groupingScheme ?? spec?.defaultGroupingScheme ?? params.defaultGroupingScheme,
      source: 'level_assignment',
    };
  }

  const bySchool = active.find((a) => !a.classId && !a.classLevel);
  if (bySchool) {
    const spec = getPublishedTemplateSpec(bySchool.templateSpecId, bySchool.templateVersion);
    return {
      template: bySchool.template,
      templateSpecId: spec ? spec.id : null,
      templateVersion: bySchool.templateVersion,
      groupingScheme: bySchool.groupingScheme ?? spec?.defaultGroupingScheme ?? params.defaultGroupingScheme,
      source: 'school_assignment',
    };
  }

  return {
    template: params.defaultTemplate,
    templateSpecId: null,
    templateVersion: 1,
    groupingScheme: params.defaultGroupingScheme,
    source: 'school_config_fallback',
  };
}

// ── Compatibilité tests phase8 historiques (résolution simplifiée) ────────────
export type BulletinTemplateType = 'FR' | 'EN' | 'PRIMARY' | 'KINDERGARTEN';

export const toPrismaBulletinTemplate = (legacy: BulletinTemplateType): BulletinTemplate => {
  switch (legacy) {
    case 'EN': return 'EN_SECONDARY';
    case 'PRIMARY': return 'PRIMARY';
    case 'KINDERGARTEN': return 'PRIMARY';
    case 'FR': return 'FR_SECONDARY';
  }
};

export const resolveBulletinTemplateType = (
  subSystemCode?: SubSystemCode,
  cycle?: SectionCycle,
  language?: 'fr' | 'en',
  bulletinTemplate?: string | null,
): BulletinTemplateType => {
  const normalizedTemplate = String(bulletinTemplate || '').trim().toUpperCase();
  if (
    normalizedTemplate === 'FR' ||
    normalizedTemplate === 'EN' ||
    normalizedTemplate === 'PRIMARY' ||
    normalizedTemplate === 'KINDERGARTEN'
  ) {
    return normalizedTemplate as BulletinTemplateType;
  }

  if (cycle === 'maternelle' || subSystemCode === 'MATERNELLE') return 'KINDERGARTEN';
  if (cycle === 'primaire' || subSystemCode === 'FR_PRIMAIRE' || subSystemCode === 'EN_PRIMAIRE') {
    return 'PRIMARY';
  }
  if (language === 'en' || String(subSystemCode || '').startsWith('EN_')) return 'EN';
  return 'FR';
};

export const getTemplateLabels = (template: BulletinTemplate | BulletinTemplateType, language: 'fr' | 'en') => {
  const isFr = language === 'fr';
  const normalized: BulletinTemplate =
    template === 'EN' ? 'EN_SECONDARY' : template === 'FR' || template === 'KINDERGARTEN' ? 'FR_SECONDARY' : template;

  if (normalized === 'EN_SECONDARY' || normalized === 'MONTHLY') {
    return {
      title: normalized === 'MONTHLY' ? 'Monthly Report Card' : 'Report Card',
      detailTitle: 'Subject Breakdown',
      classStats: 'Class Statistics',
      rank: 'Class Rank',
      average: 'Average',
      absences: 'Absences',
      late: 'Late',
      signatures: 'Signatures',
      teacherSignature: 'Class Master',
      principalSignature: 'Principal',
      note: 'Summary based on available assessments.',
    };
  }

  if (normalized === 'PRIMARY') {
    return {
      title: isFr ? 'Bulletin Primaire' : 'Primary Report Card',
      detailTitle: isFr ? 'Résultats par matière' : 'Subject Results',
      classStats: isFr ? 'Statistiques de classe' : 'Class Statistics',
      rank: isFr ? 'Rang' : 'Rank',
      average: isFr ? 'Moyenne' : 'Average',
      absences: isFr ? 'Absences' : 'Absences',
      late: isFr ? 'Retards' : 'Late',
      signatures: isFr ? 'Signatures' : 'Signatures',
      teacherSignature: isFr ? 'Titulaire' : 'Class Master',
      principalSignature: isFr ? 'Direction' : 'Principal',
      note: isFr ? 'Synthèse basée sur les évaluations de la période.' : 'Summary based on period assessments.',
    };
  }

  return {
    title: isFr ? 'Bulletin Scolaire' : 'Report Card',
    detailTitle: isFr ? 'Détail par matière' : 'Subject Breakdown',
    classStats: isFr ? 'Statistiques de classe' : 'Class Statistics',
    rank: isFr ? 'Rang' : 'Rank',
    average: isFr ? 'Moyenne' : 'Average',
    absences: isFr ? 'Absences' : 'Absences',
    late: isFr ? 'Retards' : 'Late',
    signatures: isFr ? 'Signatures' : 'Signatures',
    teacherSignature: isFr ? 'Professeur principal' : 'Class Master',
    principalSignature: isFr ? "Chef d'établissement" : 'Principal',
    note: isFr ? 'Moyenne calculée à partir des notes disponibles.' : 'Average computed from locked grades.',
  };
};
