/**
 * DOMAIN LAYER — Types du Snapshot Bulletin & Politiques de calcul
 *
 * Un BulletinSnapshot est la photographie scellée et immuable des résultats d'un élève.
 * Le moteur de rendu (PDFKit / Chromium) ne calcule jamais : il lit ce snapshot.
 */
import type { GradeValidationStatus, SubjectType } from '@domain/types/enums';

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
  annualPolicy?: AnnualAveragePolicyMode;
  sequenceCalculationMode?: 'single' | 'triple' | 'weighted';
  /** Par défaut true (Loi 4) : ne retient que les notes LOCKED */
  requireLockedGrades?: boolean;
}

export interface BulletinSubjectSnapshotLine {
  subjectId: string;
  subjectName: string;
  coefficient: number;
  groupKey: string;
  groupLabel: string;
  groupOrder: number;
  seq1Score?: number;
  seq2Score?: number;
  seq3Score?: number;
  seq4Score?: number;
  seq5Score?: number;
  seq6Score?: number;
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
  generalAverage: number;
  totalCoefficient: number;
  totalWeightedScore: number;
  rank: number;
  totalStudents: number;
  sequenceAverages?: Array<{ sequenceId: string; name: string; orderIndex: number; average: number | null }>;
  termAverages?: { trim1?: number; trim2?: number; trim3?: number };
  rankTrimestre1?: number;
  rankTrimestre2?: number;
  rankTrimestre3?: number;
  subjectLines: BulletinSubjectSnapshotLine[];
  groupSummaries: BulletinGroupSummary[];
}

export interface ClassBulletinSnapshotsResult {
  snapshotsByStudentId: Map<string, StudentBulletinSnapshot>;
  classProfile: BulletinClassProfile;
}
