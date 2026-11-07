import { describe, expect, it } from 'bun:test';
import type { CrossSchoolTransferGatewayPort } from '../../../../src/domain/ports/services/CrossSchoolTransferGatewayPort.ts';
import { DetecterIdentiteTransfertUseCase } from '../../../../src/application/studentTransfer/DetecterIdentiteTransfertUseCase.ts';

class FakeGateway implements CrossSchoolTransferGatewayPort {
  lookupCalls = 0;

  async identityExists(nationalId: string, targetSchoolId: string): Promise<{ exists: boolean }> {
    this.lookupCalls += 1;
    return { exists: nationalId === 'CM123' && targetSchoolId === 'school-b' };
  }
}

describe('DetecterIdentiteTransfertUseCase', () => {
  it('normalise le matricule et ne retourne qu’un indicateur d’existence', async () => {
    const gateway = new FakeGateway();
    const useCase = new DetecterIdentiteTransfertUseCase(gateway);

    await expect(useCase.execute({
      nationalId: ' cm 123 ',
      targetSchoolId: 'school-b',
    })).resolves.toEqual({ exists: true });
    expect(gateway.lookupCalls).toBe(1);
  });

  it('retourne true sans exposer de détail lorsque l’identité existe ailleurs', async () => {
    const gateway = new FakeGateway();
    const useCase = new DetecterIdentiteTransfertUseCase(gateway);

    await expect(useCase.execute({
      nationalId: 'CM123',
      targetSchoolId: 'school-b',
    })).resolves.toEqual({ exists: true });
  });

  it('rejette un matricule invalide avant tout accès inter-écoles', async () => {
    const gateway = new FakeGateway();
    const useCase = new DetecterIdentiteTransfertUseCase(gateway);

    await expect(useCase.execute({
      nationalId: '***',
      targetSchoolId: 'school-b',
    })).rejects.toThrow('alphanumérique');
    expect(gateway.lookupCalls).toBe(0);
  });
});
