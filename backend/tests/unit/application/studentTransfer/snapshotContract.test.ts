import { describe, expect, it } from 'bun:test';
import {
  construireSnapshotTransfert,
  TRANSFER_SNAPSHOT_CATEGORIES,
} from '../../../../src/application/studentTransfer/snapshotContract.ts';

describe('contrat du snapshot de transfert', () => {
  it('déclare uniquement les catégories autorisées', () => {
    expect(TRANSFER_SNAPSHOT_CATEGORIES).toEqual([
      'IDENTITY',
      'LOCKED_GRADES',
      'VALIDATED_REPORT_CARDS',
      'ATTENDANCE_SUMMARY',
      'ORIENTATION_DECISIONS',
      'GUARDIAN_CONTACT',
    ]);
  });

  it('exclut les champs sensibles hors liste blanche', () => {
    const source = {
      identity: { firstName: 'Awa', lastName: 'Test', nationalId: 'CM123', dateOfBirth: '2010-01-02' },
      lockedGrades: [{ subjectCode: 'MATH', academicYear: '2025-2026', value: 15 }],
      validatedReportCards: [{ academicYear: '2025-2026', reference: 'bulletin-1' }],
      attendanceSummary: [{ academicYear: '2025-2026', justified: 2, unjustified: 1 }],
      orientationDecisions: [{ academicYear: '2025-2026', decision: 'PASS' }],
      guardianContact: { firstName: 'Parent', phone: '+237600000001' },
      healthScore: 12,
      discipline: [{ label: 'exclu' }],
      followUp: [{ label: 'exclu' }],
      payments: [{ amount: 100 }],
      medical: { notes: 'exclu' },
    };

    const snapshot = construireSnapshotTransfert(source);
    const serialized = JSON.stringify(snapshot.payload);

    expect(serialized).not.toContain('healthScore');
    expect(serialized).not.toContain('discipline');
    expect(serialized).not.toContain('followUp');
    expect(serialized).not.toContain('payments');
    expect(serialized).not.toContain('medical');
    expect(snapshot.checksum).toMatch(/^[a-f0-9]{64}$/);
  });
});
