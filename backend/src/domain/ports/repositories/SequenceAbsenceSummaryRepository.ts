/**
 * DOMAIN LAYER — Port Repository : relevés consolidés d'heures d'absence par élève et par séquence.
 * Alimenté exclusivement par le surveillant général (STAFF MANAGE_ATTENDANCE) ou l'ADMIN.
 */

export interface SequenceAbsenceSummaryRecord {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  academicYearId: string;
  academicPeriodId: string;
  sequenceId: string;
  justifiedHours: number;
  unjustifiedHours: number;
  consignesCount: number;
  recordedById: string;
  updatedAt: Date;
}

export interface UpsertSequenceAbsenceSummaryInput {
  schoolId: string;
  studentId: string;
  classId: string;
  academicYearId: string;
  academicPeriodId: string;
  sequenceId: string;
  justifiedHours: number;
  unjustifiedHours: number;
  consignesCount?: number;
  recordedById: string;
}

export interface SequenceAbsenceSummaryRepository {
  upsertForSequence(input: UpsertSequenceAbsenceSummaryInput): Promise<SequenceAbsenceSummaryRecord>;
  upsertBatchForSequence(inputs: UpsertSequenceAbsenceSummaryInput[]): Promise<number>;
  findByClassAndPeriods(
    schoolId: string,
    classId: string,
    academicPeriodIds: string[],
  ): Promise<SequenceAbsenceSummaryRecord[]>;
}

