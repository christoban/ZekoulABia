/**
 * DOMAIN LAYER — Types du Snapshot Bulletin & Politiques de calcul
 *
 * Un BulletinSnapshot est la photographie scellée et immuable des résultats d'un élève.
 * Le moteur de rendu (PDFKit / Chromium) ne calcule jamais : il lit ce snapshot.
 */
import type { CouncilDecision, GradeValidationStatus, SubjectType } from '@domain/types/enums';
import type { BulletinAppreciationScaleConfig } from '@domain/types/bulletinTemplateSpec';

export type BulletinCalculationMode = 'WEIGHTED_AVERAGE' | 'POINTS_RATIO';

export type AnnualAveragePolicyMode =
  | 'SIX_SEQUENCES_ARITHMETIC'   // Défaut MINESEC/MINEDUB : (MoySeq1 + ... + MoySeq6) / N_sequences
  | 'THREE_TERMS_ARITHMETIC'     // (MoyTrim1 + MoyTrim2 + MoyTrim3) / N_trimestres
  | 'WEIGHTED_SUBJECT_AVERAGES'; // Σ(MoyAnnuelleMatiere × Coef) / Σ(Coef)

export interface SnapshotSequenceInput {
  id: string;
  name: string;
  orderIndex: number;
  /** Regroupement optionnel en trimestre (1, 2 ou 3) pour le calcul des rangs trimestriels */
  termIndex?: 1 | 2 | 3;
}

export interface SnapshotSubjectInput {
  id: string;
  name: string;
  coefficient: number;
  maxMark?: number;
  learningDomain?: string;
  learningUnit?: string;
  isLV2?: boolean;
  subjectType?: SubjectType;
  groupKey?: string;
  groupLabel?: string;
  groupOrder?: number;
  competenceLabel?: string;
  teacherName?: string;
}

export interface SnapshotStudentInput {
  id: string;
  lv2SubjectId?: string | null;
  alevelSubjectIds?: string[] | null;
}

export interface SnapshotNoteInput {
  id?: string;
  studentId: string;
  subjectId: string;
  sequenceId: string;
  coefficient: number;
  maxValue?: number;
  sequenceScore?: number | null;
  classTestScore?: number | null;
  terminalExamScore?: number | null;
  theoreticalScore?: number | null;
  practicalScore?: number | null;
  professionalAttitude?: number | null;
  oralScore?: number | null;
  selfDevelopmentScore?: number | null;
  sequenceAverage?: number | null;
  validationStatus: GradeValidationStatus;
  isAbsentGrade?: boolean;
  observation?: string | null;
}

export interface BulletinSnapshotBuildInput {
  students: SnapshotStudentInput[];
  subjects: SnapshotSubjectInput[];
  sequences: SnapshotSequenceInput[];
  notes: SnapshotNoteInput[];
  hasCoefficientBySubject: boolean;
  excludeAbsentGrades?: boolean;
  passThresholdOn20?: number;
  isAnnual?: boolean;
  calculationMode?: BulletinCalculationMode;
  annualPolicy?: AnnualAveragePolicyMode;
  sequenceCalculationMode?: 'single' | 'triple' | 'weighted';
  /** Seuils configurables de cotes et niveaux de compétence (spec ou politique établissement) */
  scaleConfig?: BulletinAppreciationScaleConfig;
  /** Par défaut true (Loi 4) : ne retient que les notes LOCKED */
  requireLockedGrades?: boolean;
}

export interface StudentIdentitySnapshot {
  studentId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  matricule: string | null;
  dateOfBirth: string | null;
  placeOfBirth: string | null;
  gender: string | null;
  isRepeater: boolean;
  photoUrl: string | null;
}

export interface BulletinConductSanctionItem {
  id: string;
  type: string;
  reason: string;
  createdAt: string;
}

export interface BulletinConductSnapshot {
  /** Heures d'absence réelles si une durée fiable est disponible ; null sinon (affiché « — » sur le bulletin). */
  justifiedAbsenceHours: number | null;
  unjustifiedAbsenceHours: number | null;
  totalAbsenceHours: number | null;
  trimesterAbsences?: {
    t1?: { j: number | null; nj: number | null };
    t2?: { j: number | null; nj: number | null };
    t3?: { j: number | null; nj: number | null };
  };
  workDayPenaltyDays?: number | null;
  totalAbsenceDays: number;
  lateCount: number;
  warningsCount: number;
  blamesCount: number;
  exclusionsCount: number;
  consignesCount: number;
  sanctions: BulletinConductSanctionItem[];
}

export interface BulletinCouncilDecisionSnapshot {
  decision: CouncilDecision;
  observations: string | null;
  honorRoll: boolean;
  encouragements: boolean;
  congratulations: boolean;
  workWarning?: boolean;
  workBlame?: boolean;
  conductWarning?: boolean;
  conductBlame?: boolean;
  promotedToClass?: string | null;
  repeatClass?: string | null;
  excluded?: boolean;
  exclusionReasons?: {
    insufficientAverage?: boolean;
    alreadyRepeated?: boolean;
    deplorableConduct?: boolean;
    tooManyAbsences?: boolean;
    tooOld?: boolean;
  };
  apcObservations?: {
    makingProgress?: boolean;
    declining?: boolean;
    conductWarning?: boolean;
    tooManyAbsences?: boolean;
    riskOfExpulsion?: boolean;
    effortRequiredIn?: string | null;
  };
}

export interface BulletinSubjectSnapshotLine {
  subjectId: string;
  subjectName: string;
  coefficient: number;
  rawMark?: number;
  maxMark?: number;
  learningDomain?: string;
  learningUnit?: string;
  groupKey: string;
  groupLabel: string;
  groupOrder: number;
  seq1Score?: number;
  seq2Score?: number;
  seq3Score?: number;
  seq4Score?: number;
  seq5Score?: number;
  seq6Score?: number;
  trim1Average?: number;
  trim2Average?: number;
  trim3Average?: number;
  classTestScore?: number;
  terminalExamScore?: number;
  theoreticalScore?: number;
  practicalScore?: number;
  professionalAttitude?: number;
  oralScore?: number;
  selfDevelopmentScore?: number;
  subjectAverage: number;
  weightedScore: number;
  subjectRank: number;
  subjectTotalStudents: number;
  classSubjectAverage: number;
  minSubjectAverage: number;
  maxSubjectAverage: number;
  teacherComment?: string;
  teacherName?: string;
  competenceLabel?: string;
  competenceCote?: 'A+' | 'A' | 'ECA' | 'NA';
  competenceLevelLabel?: string;
}

export interface BulletinGroupSummary {
  groupKey: string;
  groupLabel: string;
  groupOrder: number;
  totalCoefficient: number;
  totalWeightedScore: number;
  groupAverage: number;
  groupRank: number;
  groupTotalStudents: number;
}

export interface BulletinGroupPeriodBreakdown {
  seq1Average?: number;
  seq2Average?: number;
  seq3Average?: number;
  seq4Average?: number;
  seq5Average?: number;
  seq6Average?: number;
  trim1Average?: number;
  trim2Average?: number;
  trim3Average?: number;
  groupCompetenceLabel?: string;
}

export interface BulletinClassProfile {
  classSize: number;
  classAverage: number;
  topAverage: number;
  lowAverage: number;
  passCount: number;
  passRate: number;
}

export interface StudentBulletinSnapshot {
  studentId: string;
  computationVersion: number;
  templateVersion: number;
  calculationMode?: BulletinCalculationMode;
  totalRawMarks?: number;
  totalMaxMarks?: number;
  generalAverage: number;
  totalCoefficient: number;
  totalWeightedScore: number;
  rank: number;
  totalStudents: number;
  sequenceAverages?: Array<{ sequenceId: string; name: string; orderIndex: number; average: number | null; rank?: number }>;
  termAverages?: { trim1?: number; trim2?: number; trim3?: number };
  rankTrimestre1?: number;
  rankTrimestre2?: number;
  rankTrimestre3?: number;
  studentIdentity?: StudentIdentitySnapshot;
  mainTeacherName?: string | null;
  conduct?: BulletinConductSnapshot;
  councilDecision?: BulletinCouncilDecisionSnapshot;
  classProfile?: BulletinClassProfile;
  subjectLines: BulletinSubjectSnapshotLine[];
  groupSummaries: BulletinGroupSummary[];
  groupBreakdowns?: Record<string, BulletinGroupPeriodBreakdown>;
}

export interface ClassBulletinSnapshotsResult {
  snapshotsByStudentId: Map<string, StudentBulletinSnapshot>;
  classProfile: BulletinClassProfile;
}
