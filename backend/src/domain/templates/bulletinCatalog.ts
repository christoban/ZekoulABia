/**
 * DOMAIN LAYER — Catalogue officiel des modèles de bulletins par blocs
 *
 * Contient les specs JSON déclaratives des familles (Étape 4 : Famille A GENERAL_GROUPED_V1).
 * Toute spec publiée est profondément figée (immuable) : toute modification crée une
 * nouvelle version (`version + 1`) sans jamais altérer la version déjà émise.
 */
import type { BulletinTemplate } from '@domain/types/enums';
import {
  deepFreezeSpec,
  type BulletinSpecValidationStatus,
  type BulletinTemplateBlock,
  type BulletinTemplateSpec,
} from '@domain/types/bulletinTemplateSpec';
import {
  ANNUAL_BILINGUAL_SPEC_ID,
  ANNUAL_BILINGUAL_V1,
  BILINGUAL_APC_SPEC_ID,
  BILINGUAL_APC_V1,
  EN_SECONDARY_SPEC_ID,
  EN_SECONDARY_V1,
  PRIMARY_POINTS_RATIO_EN_SPEC_ID,
  PRIMARY_POINTS_RATIO_EN_V1,
  PRIMARY_POINTS_RATIO_FR_LABELS_SPEC_ID,
  PRIMARY_POINTS_RATIO_FR_LABELS_V1,
  TECH_GROUPED_SPEC_ID,
  TECH_GROUPED_V1,
} from './bulletinCatalogFamilies';

export {
  deepFreezeSpec,
  ANNUAL_BILINGUAL_SPEC_ID,
  ANNUAL_BILINGUAL_V1,
  BILINGUAL_APC_SPEC_ID,
  BILINGUAL_APC_V1,
  EN_SECONDARY_SPEC_ID,
  EN_SECONDARY_V1,
  PRIMARY_POINTS_RATIO_EN_SPEC_ID,
  PRIMARY_POINTS_RATIO_EN_V1,
  PRIMARY_POINTS_RATIO_FR_LABELS_SPEC_ID,
  PRIMARY_POINTS_RATIO_FR_LABELS_V1,
  TECH_GROUPED_SPEC_ID,
  TECH_GROUPED_V1,
};

export const GENERAL_GROUPED_SPEC_ID = 'GENERAL_GROUPED_V1' as const;

function cloneSpec(spec: BulletinTemplateSpec): BulletinTemplateSpec {
  return structuredClone(spec);
}

export const GENERAL_GROUPED_V1: Readonly<BulletinTemplateSpec> = deepFreezeSpec<BulletinTemplateSpec>({
  id: GENERAL_GROUPED_SPEC_ID,
  familyKey: 'A',
  targetTemplate: 'FR_SECONDARY',
  name: 'Famille A — Secondaire Général par Groupes (Collège Le Québécois 3ème)',
  version: 1,
  status: 'PUBLISHED',
  validationStatus: 'VALIDATED',
  defaultGroupingScheme: 'SCI_LIT_OTHER',
  language: 'bilingual',
  grayscaleFirst: true,
  page: {
    size: 'A4',
    orientation: 'portrait',
    margin: 24,
  },
  blocks: [
    {
      type: 'officialHeader',
      bilingual: true,
      showDelegations: true,
      showLogo: true,
      showCoatOfArms: true,
      showMotto: true,
      periodLabelMode: 'AUTO',
    },
    {
      type: 'studentCard',
      fields: ['photo', 'matricule', 'birth', 'sex', 'repeater', 'classSize', 'mainTeacher'],
    },
    {
      type: 'subjectTable',
      grouping: 'byGroup',
      showGroupSubtotals: true,
      appreciationScale: 'A+/A/ECA/NA',
      scaleConfig: {
        // À CONFIRMER SUR LE TERRAIN : Famille A garde NA < 10 (ongoingInclusive: true) jusqu'à validation terrain.
        cote: { ongoingMin: 10, ongoingInclusive: true, acquiredMin: 15, acquiredInclusive: true, expertMin: 18, expertInclusive: true },
      },
      columns: [
        { key: 'subjectName', labelFr: 'MATIÈRES', labelEn: 'SUBJECTS', ratio: 19, align: 'left' },
        { key: 'seq1Score', labelFr: 'CC /20', labelEn: 'CA /20', ratio: 6.5, align: 'center' },
        { key: 'seq2Score', labelFr: 'DS /20', labelEn: 'EX /20', ratio: 6.5, align: 'center' },
        { key: 'subjectAverage', labelFr: 'EVA /20', labelEn: 'AVG /20', ratio: 7, align: 'center' },
        { key: 'coefficient', labelFr: 'COEF', labelEn: 'COEF', ratio: 5, align: 'center' },
        { key: 'weightedScore', labelFr: 'TOTAL', labelEn: 'TOTAL', ratio: 7, align: 'center' },
        { key: 'subjectRank', labelFr: 'RANG', labelEn: 'RANK', ratio: 5.5, align: 'center' },
        { key: 'cote', labelFr: 'COTE', labelEn: 'GRADE', ratio: 5.5, align: 'center' },
        { key: 'teacherComment', labelFr: 'APPRÉCIATION', labelEn: 'REMARKS', ratio: 23, align: 'left' },
        { key: 'teacherName', labelFr: 'ENSEIGNANT', labelEn: 'TEACHER', ratio: 15, align: 'left' },
      ],
    },
    {
      type: 'classProfile',
      fields: ['classAverage', 'topAverage', 'lowAverage', 'passCount', 'passRate'],
    },
    {
      type: 'councilDecision',
      items: [
        'honorRoll',
        'encouragements',
        'congratulations',
        'workWarning',
        'conductWarning',
        'blame',
        'disciplinaryCouncil',
        'exclusion',
        'decision',
        'observations',
      ],
    },
    {
      type: 'conductSummary',
      absenceUnit: 'hours',
      fields: ['absJ', 'absNJ', 'totalHours', 'late', 'consignes', 'warnings', 'blames', 'exclusions'],
    },
    {
      type: 'signatures',
      slots: ['mainTeacher', 'parent', 'principal'],
      showStamp: true,
      showPlaceholder: false,
      showPlaceDate: true,
    },
    {
      type: 'verifyQr',
      position: 'bottomRight',
      showVerificationCode: true,
    },
  ],
});

const PUBLISHED_CATALOG: readonly Readonly<BulletinTemplateSpec>[] = [
  GENERAL_GROUPED_V1,
  TECH_GROUPED_V1,
  BILINGUAL_APC_V1,
  ANNUAL_BILINGUAL_V1,
  EN_SECONDARY_V1,
  PRIMARY_POINTS_RATIO_EN_V1,
  PRIMARY_POINTS_RATIO_FR_LABELS_V1,
];

const customSpecsRegistry: Array<Readonly<BulletinTemplateSpec>> = [];

export function clearCustomTemplateSpecsForRestartSimulation(): void {
  customSpecsRegistry.length = 0;
}

export function hydrateTemplateSpecsFromStore(specs: readonly BulletinTemplateSpec[]): number {
  let added = 0;
  for (const spec of specs) {
    const exists = [...PUBLISHED_CATALOG, ...customSpecsRegistry].some(
      (s) => s.id === spec.id && s.version === spec.version,
    );
    if (!exists) {
      const frozen = Object.isFrozen(spec) ? spec : deepFreezeSpec(structuredClone(spec));
      customSpecsRegistry.push(frozen);
      added += 1;
    }
  }
  return added;
}

export function registerTemplateSpecVersion(spec: BulletinTemplateSpec): Readonly<BulletinTemplateSpec> {
  const frozen = Object.isFrozen(spec) ? spec : deepFreezeSpec(structuredClone(spec));
  const exists = [...PUBLISHED_CATALOG, ...customSpecsRegistry].some(
    (s) => s.id === frozen.id && s.version === frozen.version,
  );
  if (exists) {
    throw new Error(`La spec "${frozen.id}" v${frozen.version} existe déjà et est immuable.`);
  }
  customSpecsRegistry.push(frozen);
  return frozen;
}

export function listAllTemplateSpecs(options?: { includeDrafts?: boolean }): readonly Readonly<BulletinTemplateSpec>[] {
  const all = [...PUBLISHED_CATALOG, ...customSpecsRegistry];
  if (options?.includeDrafts) return all;
  return all.filter((s) => s.status !== 'DRAFT');
}

export function listPublishedTemplateSpecs(): readonly Readonly<BulletinTemplateSpec>[] {
  return listAllTemplateSpecs({ includeDrafts: false });
}

export function getTemplateSpecAnyStatus(
  specId: string,
  version?: number,
): Readonly<BulletinTemplateSpec> | null {
  const matches = listAllTemplateSpecs({ includeDrafts: true }).filter((s) => s.id === specId);
  if (matches.length === 0) return null;
  if (version !== undefined) {
    return matches.find((s) => s.version === version) ?? null;
  }
  return matches.slice().sort((a, b) => b.version - a.version)[0] ?? null;
}

export function getPublishedTemplateSpec(
  specId: string,
  version?: number,
): Readonly<BulletinTemplateSpec> | null {
  const matches = listPublishedTemplateSpecs().filter((s) => s.id === specId);
  if (matches.length === 0) return null;
  if (version !== undefined) {
    return matches.find((s) => s.version === version) ?? null;
  }
  return matches.slice().sort((a, b) => b.version - a.version)[0] ?? null;
}

export function isSpecValidatedForProduction(
  spec: Pick<BulletinTemplateSpec, 'status' | 'validationStatus'>,
): boolean {
  return spec.status !== 'DRAFT' && spec.validationStatus !== 'TO_VALIDATE';
}

export function findDefaultSpecForTemplate(
  template: BulletinTemplate,
): Readonly<BulletinTemplateSpec> | null {
  return (
    listPublishedTemplateSpecs().find(
      (s) => s.targetTemplate === template && isSpecValidatedForProduction(s),
    ) ?? null
  );
}

export function hasPublishedTemplateSpecForTemplate(template: BulletinTemplate): boolean {
  return findDefaultSpecForTemplate(template) !== null;
}

export interface TemplateSpecUpdateDraft {
  name?: string;
  language?: 'fr' | 'en' | 'bilingual';
  grayscaleFirst?: boolean;
  defaultGroupingScheme?: BulletinTemplateSpec['defaultGroupingScheme'];
  showGroupRankInSubtotal?: boolean;
  validationStatus?: BulletinSpecValidationStatus;
  validationNotice?: string;
  page?: Partial<BulletinTemplateSpec['page']>;
  blocks?: BulletinTemplateBlock[];
  publish?: boolean;
}

/**
 * Une spec publiée est immuable : toute évolution crée obligatoirement une nouvelle version.
 */
export function createNewTemplateSpecVersion(
  publishedSpec: BulletinTemplateSpec,
  changes: TemplateSpecUpdateDraft,
): Readonly<BulletinTemplateSpec> {
  if (!Object.isFrozen(publishedSpec)) {
    deepFreezeSpec(publishedSpec);
  }
  const base = cloneSpec(publishedSpec);
  const existingVersions = listAllTemplateSpecs({ includeDrafts: true })
    .filter((s) => s.id === base.id)
    .map((s) => s.version);
  const nextVersion = Math.max(base.version, ...existingVersions, 0) + 1;
  const nextSpec: BulletinTemplateSpec = {
    ...base,
    name: changes.name ?? base.name,
    language: changes.language ?? base.language,
    grayscaleFirst: changes.grayscaleFirst ?? base.grayscaleFirst,
    defaultGroupingScheme: changes.defaultGroupingScheme ?? base.defaultGroupingScheme,
    showGroupRankInSubtotal: changes.showGroupRankInSubtotal ?? base.showGroupRankInSubtotal,
    validationStatus: changes.validationStatus ?? base.validationStatus,
    validationNotice: changes.validationNotice !== undefined ? changes.validationNotice : base.validationNotice,
    page: {
      ...base.page,
      ...(changes.page ?? {}),
    },
    blocks: changes.blocks ? structuredClone(changes.blocks) : base.blocks,
    version: nextVersion,
    status: changes.publish === false ? 'DRAFT' : 'PUBLISHED',
  };
  return deepFreezeSpec(nextSpec);
}

