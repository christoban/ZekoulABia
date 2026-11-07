import { describe, expect, it } from 'bun:test';
import { construireSnapshotTransfert } from '../../../../src/application/studentTransfer/snapshotContract.ts';
import { creerFixtureDeuxEcoles } from '../../../helpers/studentTransferFixture.ts';

describe('fixture reproductible de transfert', () => {
  it('contient deux écoles et les données de test 1H', () => {
    const fixture = creerFixtureDeuxEcoles();
    const snapshot = construireSnapshotTransfert(fixture.snapshotSource);

    expect(fixture.sourceSchoolId).not.toBe(fixture.targetSchoolId);
    expect(fixture.snapshotSource.lockedGrades).toHaveLength(1);
    expect(fixture.snapshotSource.validatedReportCards).toHaveLength(1);
    expect(fixture.snapshotSource.guardianContact.phone).toBe('+237600000001');
    expect(fixture.excluded.discipline).toHaveLength(1);
    expect(fixture.excluded.followUp).toHaveLength(1);
    expect(JSON.stringify(snapshot.payload)).not.toContain('discipline');
    expect(JSON.stringify(snapshot.payload)).not.toContain('followUp');
  });
});
