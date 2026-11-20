/**
 * DOMAIN LAYER — Spécification JSON déclarative d'un modèle de bulletin par blocs
 *
 * Découple entièrement la mise en page visuelle des calculs du BulletinSnapshotBuilder.
 * Chaque famille (A..F) et chaque variante calibrée par un établissement s'appuie sur ce schéma.
 */

import type { BulletinCalculationMode } from '@domain/types/bulletinSnapshot';
import type { BulletinGroupingScheme } from '@domain/services/bulletin/bulletinGroupingSchemes';
import type { BulletinTemplate } from '@domain/types/enums';

export type BulletinFamilyKey = 'A' | 'B' | 'C' | 'D' | 'E' | 'F';

export type BulletinLayoutVariant =
  | 'STANDARD_GROUPED'
  | 'ANNUAL_BILINGUAL'
  | 'TECHNICAL_GROUPED'
  | 'BILINGUAL_APC'
  | 'EN_SECONDARY'
  | 'PRIMARY_POINTS_RATIO';

export type SubjectTableColumnKey =
  | 'subjectName'
  | 'rawMark'
  | 'maxMark'
  | 'learningUnit'
  | 'seq1Score'
  | 'seq2Score'
  | 'seq3Score'
  | 'seq4Score'
  | 'seq5Score'
  | 'seq6Score'
  | 'trim1Average'
  | 'trim2Average'
  | 'trim3Average'
  | 'classTestScore'
  | 'terminalExamScore'
  | 'theoreticalScore'
  | 'practicalScore'
  | 'oralScore'
  | 'selfDevelopmentScore'
  | 'coefficient'
  | 'subjectAverage'
  | 'weightedScore'
  | 'subjectRank'
  | 'cote'
  | 'classSubjectAverage'
  | 'teacherComment'
  | 'teacherName'
  | 'teacherVisa'
  | 'competenceLabel'
  | 'competenceLevel';

export interface SubjectTableColumnSpec {
  key: SubjectTableColumnKey;
  labelFr: string;
  labelEn: string;
  ratio: number;
  align?: 'left' | 'center' | 'right';
}

export type PeriodLabelMode =
  | 'AUTO'
  | 'EVALUATION'
  | 'SEQUENCE'
  | 'TRIMESTER'
  | 'TERM'
  | 'ANNUAL'
  | 'MONTHLY';

export type OfficialMinistryHeader = 'MINESEC' | 'MINEDUB';

export interface OfficialHeaderBlockSpec {
  type: 'officialHeader';
  bilingual: boolean;
  ministry?: OfficialMinistryHeader;
  showDelegations: boolean;
  showLogo: boolean;
  showCoatOfArms: boolean;
  showMotto: boolean;
  periodLabelMode?: PeriodLabelMode;
}

export interface StudentCardBlockSpec {
  type: 'studentCard';
  fields: Array<'photo' | 'matricule' | 'birth' | 'sex' | 'repeater' | 'classSize' | 'mainTeacher'>;
}

export interface CoteScaleThresholds {
  /** Minimum pour A+ (ex. 18 => [18-20]) */
  expertMin: number;
  /** true (défaut) : >= expertMin ; false : > expertMin */
  expertInclusive?: boolean;
  /** Minimum pour A (ex. 15 => [15-17,99]) */
  acquiredMin: number;
  /** true (défaut) : >= acquiredMin ; false : > acquiredMin */
  acquiredInclusive?: boolean;
  /** Minimum pour ECA (ex. 10 sur Famille A, > 10 sur Primaire F où NA = [0;10] inclus) */
  ongoingMin: number;
  /** true (défaut) : >= ongoingMin (NA < ongoingMin) ; false : > ongoingMin (NA <= ongoingMin) */
  ongoingInclusive?: boolean;
}

export interface CompetenceScaleThresholds {
  /** Minimum pour Niveau Expert (ex. 18 => >= 18) */
  expertMin: number;
  expertInclusive?: boolean;
  /** Minimum pour Compétence acquise (ex. 14 sur Garoua/Djamboutou) */
  acquiredMin: number;
  acquiredInclusive?: boolean;
  /** Minimum pour En cours d'acquisition (ex. 11 sur Garoua/Djamboutou) */
  ongoingMin: number;
  ongoingInclusive?: boolean;
}

export interface BulletinAppreciationScaleConfig {
  cote?: CoteScaleThresholds;
  competence?: CompetenceScaleThresholds;
}

export interface SubjectTableBlockSpec {
  type: 'subjectTable';
  grouping: 'byGroup' | 'flat';
  groupByDomain?: boolean;
  showGroupSubtotals: boolean;
  showTotalBar?: boolean;
  appreciationScale: 'A+/A/ECA/NA' | 'APC_TEXT' | 'FREE_TEXT';
  scaleConfig?: BulletinAppreciationScaleConfig;
  formulaHint?: string;
  columns: SubjectTableColumnSpec[];
}

export interface ClassProfileBlockSpec {
  type: 'classProfile';
  fields: Array<'classAverage' | 'topAverage' | 'lowAverage' | 'passCount' | 'passRate'>;
}

export type CouncilDecisionSpecItem =
  | 'honorRoll'
  | 'encouragements'
  | 'congratulations'
  | 'decision'
  | 'observations'
  | 'warning'
  | 'workWarning'
  | 'conductWarning'
  | 'blame'
  | 'disciplinaryCouncil'
  | 'exclusion';

export interface CouncilDistinctionThresholds {
  honorRollMinAverage: number;
  honorRollMaxRank?: number;
  encouragementsMinAverage: number;
  encouragementsMaxRank?: number;
  congratulationsMinAverage: number;
  congratulationsMaxRank?: number;
  workWarningMaxAverage: number;
  workBlameMaxAverage: number;
}

export interface CouncilDecisionBlockSpec {
  type: 'councilDecision';
  items: CouncilDecisionSpecItem[];
  distinctionThresholds?: Partial<CouncilDistinctionThresholds>;
}

export interface ConductSummaryBlockSpec {
  type: 'conductSummary';
  absenceUnit: 'hours' | 'days';
  fields: Array<'absJ' | 'absNJ' | 'totalHours' | 'days' | 'late' | 'consignes' | 'warnings' | 'blames' | 'exclusions'>;
}

export interface SignaturesBlockSpec {
  type: 'signatures';
  slots: Array<'parent' | 'mainTeacher' | 'vicePrincipal' | 'principal'>;
  showStamp: boolean;
  showPlaceholder?: boolean;
  showPlaceDate: boolean;
}

export interface VerifyQrBlockSpec {
  type: 'verifyQr';
  position: 'bottomRight' | 'bottomLeft';
  showVerificationCode: boolean;
}

export type BulletinTemplateBlock =
  | OfficialHeaderBlockSpec
  | StudentCardBlockSpec
  | SubjectTableBlockSpec
  | ClassProfileBlockSpec
  | CouncilDecisionBlockSpec
  | ConductSummaryBlockSpec
  | SignaturesBlockSpec
  | VerifyQrBlockSpec;

export type BulletinSpecValidationStatus = 'VALIDATED' | 'TO_VALIDATE';

export interface BulletinTemplateSpec {
  id: string;
  familyKey: BulletinFamilyKey;
  targetTemplate?: BulletinTemplate;
  layoutVariant?: BulletinLayoutVariant;
  calculationMode?: BulletinCalculationMode;
  showGroupRankInSubtotal?: boolean;
  validationStatus?: BulletinSpecValidationStatus;
  validationNotice?: string;
  name: string;
  version: number;
  status?: 'DRAFT' | 'PUBLISHED';
  defaultGroupingScheme?: BulletinGroupingScheme;
  language: 'fr' | 'en' | 'bilingual';
  grayscaleFirst: boolean;
  page: {
    size: 'A4';
    orientation: 'portrait' | 'landscape';
    margin: number;
  };
  blocks: BulletinTemplateBlock[];
}

export function deepFreezeSpec<T>(value: T): Readonly<T> {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    for (const item of value) deepFreezeSpec(item);
  } else {
    for (const key of Object.keys(value)) {
      deepFreezeSpec((value as Record<string, unknown>)[key]);
    }
  }
  return Object.freeze(value);
}

