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

export interface OfficialHeaderBlockSpec {
  type: 'officialHeader';
  bilingual: boolean;
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

export interface SubjectTableBlockSpec {
  type: 'subjectTable';
  grouping: 'byGroup' | 'flat';
  groupByDomain?: boolean;
  showGroupSubtotals: boolean;
  showTotalBar?: boolean;
  appreciationScale: 'A+/A/ECA/NA' | 'APC_TEXT' | 'FREE_TEXT';
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

export interface CouncilDecisionBlockSpec {
  type: 'councilDecision';
  items: CouncilDecisionSpecItem[];
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

export interface BulletinTemplateSpec {
  id: string;
  familyKey: BulletinFamilyKey;
  targetTemplate?: BulletinTemplate;
  layoutVariant?: BulletinLayoutVariant;
  calculationMode?: BulletinCalculationMode;
  showGroupRankInSubtotal?: boolean;
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

