import type { TransferSnapshotSource } from '../../src/application/studentTransfer/snapshotContract.ts';

export interface StudentTransferFixture {
  sourceSchoolId: string;
  targetSchoolId: string;
  sourceStudentProfileId: string;
  targetStudentProfileId: string;
  snapshotSource: TransferSnapshotSource;
  excluded: {
    discipline: ReadonlyArray<{ label: string }>;
    followUp: ReadonlyArray<{ label: string }>;
    healthScore: number;
    payments: ReadonlyArray<{ amount: number }>;
    medical: { notes: string };
  };
}

export function creerFixtureDeuxEcoles(): StudentTransferFixture {
  return {
    sourceSchoolId: 'school-source-fixture',
    targetSchoolId: 'school-target-fixture',
    sourceStudentProfileId: 'student-profile-source-fixture',
    targetStudentProfileId: 'student-profile-target-fixture',
    snapshotSource: {
      identity: {
        firstName: 'Awa',
        lastName: 'Fixture',
        nationalId: 'CMFIXTURE001',
        dateOfBirth: '2010-01-02',
      },
      lockedGrades: [
        { subjectCode: 'MATH', academicYear: '2025-2026', value: 15 },
      ],
      validatedReportCards: [
        { academicYear: '2025-2026', reference: 'published-report-card-fixture' },
      ],
      attendanceSummary: [
        { academicYear: '2025-2026', justified: 2, unjustified: 1 },
      ],
      orientationDecisions: [
        { academicYear: '2025-2026', decision: 'PASS' },
      ],
      guardianContact: {
        firstName: 'Parent Fixture',
        phone: '+237600000001',
      },
    },
    excluded: {
      discipline: [{ label: 'discipline-fixture' }],
      followUp: [{ label: 'follow-up-fixture' }],
      healthScore: 12,
      payments: [{ amount: 100 }],
      medical: { notes: 'medical-fixture' },
    },
  };
}
