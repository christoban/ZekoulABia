import { createHash } from 'node:crypto';

export const TRANSFER_SNAPSHOT_CATEGORIES = [
  'IDENTITY',
  'LOCKED_GRADES',
  'VALIDATED_REPORT_CARDS',
  'ATTENDANCE_SUMMARY',
  'ORIENTATION_DECISIONS',
  'GUARDIAN_CONTACT',
] as const;

export const TRANSFER_SNAPSHOT_CATEGORY_SET: ReadonlySet<string> = new Set(TRANSFER_SNAPSHOT_CATEGORIES);

export interface TransferSnapshotSource {
  identity: {
    firstName: string;
    lastName: string;
    nationalId: string;
    dateOfBirth: string | null;
  };
  lockedGrades: ReadonlyArray<{
    subjectCode: string;
    academicYear: string;
    value: number;
  }>;
  validatedReportCards: ReadonlyArray<{
    academicYear: string;
    reference: string;
  }>;
  attendanceSummary: ReadonlyArray<{
    academicYear: string;
    justified: number;
    unjustified: number;
  }>;
  orientationDecisions: ReadonlyArray<{
    academicYear: string;
    decision: string;
  }>;
  guardianContact: {
    firstName: string;
    phone: string;
  };
}

export interface TransferSnapshotPayload extends TransferSnapshotSource {
  schemaVersion: '1.0';
  categories: typeof TRANSFER_SNAPSHOT_CATEGORIES;
  generatedAt: string;
  deleteAfter: string;
}

export interface TransferSnapshotEnvelope {
  payload: TransferSnapshotPayload;
  checksum: string;
}

export function construireSnapshotTransfert(
  source: TransferSnapshotSource,
  generatedAt = new Date(),
): TransferSnapshotEnvelope {
  const deleteAfter = new Date(generatedAt);
  deleteAfter.setUTCDate(deleteAfter.getUTCDate() + 30);

  const payload: TransferSnapshotPayload = {
    schemaVersion: '1.0',
    categories: TRANSFER_SNAPSHOT_CATEGORIES,
    generatedAt: generatedAt.toISOString(),
    deleteAfter: deleteAfter.toISOString(),
    identity: { ...source.identity },
    lockedGrades: source.lockedGrades.map(grade => ({ ...grade })),
    validatedReportCards: source.validatedReportCards.map(reportCard => ({ ...reportCard })),
    attendanceSummary: source.attendanceSummary.map(summary => ({ ...summary })),
    orientationDecisions: source.orientationDecisions.map(decision => ({ ...decision })),
    guardianContact: { ...source.guardianContact },
  };
  const canonicalPayload = JSON.stringify(payload);
  const checksum = createHash('sha256').update(canonicalPayload, 'utf8').digest('hex');

  return { payload, checksum };
}
