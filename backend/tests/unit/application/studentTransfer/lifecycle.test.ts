import { describe, expect, it } from 'bun:test';
import type { StudentTransferLifecycleRepository } from '../../../../src/domain/ports/repositories/StudentTransferLifecycleRepository.ts';
import { MarquerEleveTransfereUseCase } from '../../../../src/application/studentTransfer/MarquerEleveTransfereUseCase.ts';
import { getTransferredStudentAccess } from '../../../../src/application/studentTransfer/transferAccessPolicy.ts';

class FakeLifecycleRepository implements StudentTransferLifecycleRepository {
  calls = 0;
  received = 0;

  async markSourceTransferred(): Promise<void> {
    this.calls += 1;
  }

  async markTargetReceived(): Promise<boolean> {
    this.received += 1;
    return true;
  }
}

describe('cycle de vie TRANSFERRED', () => {
  it('ne marque pas la source avant la complétion du transfert', async () => {
    const repository = new FakeLifecycleRepository();
    const useCase = new MarquerEleveTransfereUseCase(repository);

    await expect(useCase.execute({
      transferRequestId: 'request-a',
      sourceStudentProfileId: 'student-a',
      sourceSchoolId: 'school-a',
      targetSchoolId: 'school-b',
      status: 'APPROVED',
    })).rejects.toThrow('COMPLETED');
    expect(repository.calls).toBe(0);
  });

  it('marque la source une seule fois après complétion', async () => {
    const repository = new FakeLifecycleRepository();
    const useCase = new MarquerEleveTransfereUseCase(repository);

    await useCase.execute({
      transferRequestId: 'request-a',
      sourceStudentProfileId: 'student-a',
      sourceSchoolId: 'school-a',
      targetSchoolId: 'school-b',
      status: 'COMPLETED',
    });

    expect(repository.calls).toBe(1);
  });

  it('refuse une transition intra-école', async () => {
    const repository = new FakeLifecycleRepository();
    const useCase = new MarquerEleveTransfereUseCase(repository);

    await expect(useCase.execute({
      transferRequestId: 'request-a',
      sourceStudentProfileId: 'student-a',
      sourceSchoolId: 'school-a',
      targetSchoolId: 'school-a',
      status: 'COMPLETED',
    })).rejects.toThrow('écoles distinctes');
  });

  it('conserve la connexion et l’historique, mais interdit les mutations courantes', () => {
    expect(getTransferredStudentAccess('TRANSFERRED')).toEqual({
      canLogin: true,
      canReadHistory: true,
      canMutateCurrentData: false,
      preservePastAttendance: true,
      preservePastGrades: true,
      preservePayments: true,
    });
  });
});
