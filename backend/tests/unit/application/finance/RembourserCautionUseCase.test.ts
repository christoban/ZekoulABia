import { describe, it, expect, beforeEach } from 'bun:test';
import { RembourserCautionUseCase } from '../../../../src/application/finance/RembourserCautionUseCase.ts';
import { InMemoryPaiementRepository } from '../../../helpers/repositories/InMemoryPaiementRepository.ts';
import { Paiement } from '@domain/entities/Paiement';

describe('RembourserCautionUseCase', () => {
  let paiementRepo: InMemoryPaiementRepository;
  let useCase: RembourserCautionUseCase;

  beforeEach(() => {
    paiementRepo = new InMemoryPaiementRepository();
    useCase = new RembourserCautionUseCase(paiementRepo);
    // Fixture recréée à chaque test — évite les mutations inter-tests
    paiementRepo.ajouter(Paiement.reconstituer({
      id: 'caution-1',
      schoolId: 'school-1',
      studentId: 'eleve-1',
      amount: 25000,
      currency: 'XAF',
      method: 'MTN_MOMO',
      status: 'SUCCESS',
      feeType: 'CAUTION',
      cautionStatus: 'HELD',
      createdAt: new Date(),
    }));
  });

  it('devrait rembourser une caution HELD', async () => {
    await useCase.execute({
      paiementId: 'caution-1',
      rembourseurId: 'intendant-1',
      schoolId: 'school-1',
      action: 'REMBOURSER',
    });

    const paiement = await paiementRepo.findById('caution-1');
    expect(paiement?.cautionStatus).toBe('REFUNDED');
    expect(paiement?.status).toBe('REFUNDED');
  });

  it('devrait retenir définitivement une caution (dommages)', async () => {
    await useCase.execute({
      paiementId: 'caution-1',
      rembourseurId: 'intendant-1',
      schoolId: 'school-1',
      action: 'RETENIR_DEFINITIVEMENT',
    });

    const paiement = await paiementRepo.findById('caution-1');
    expect(paiement?.cautionStatus).toBe('PERMANENTLY_HELD');
  });

  it("devrait rejeter si le paiement n'est pas une caution", async () => {
    const paiementNormal = Paiement.reconstituer({
      id: 'paiement-normal',
      schoolId: 'school-1',
      studentId: 'eleve-1',
      amount: 10000,
      currency: 'XAF',
      method: 'CASH',
      status: 'SUCCESS',
      feeType: 'TUITION',
      createdAt: new Date(),
    });
    paiementRepo.ajouter(paiementNormal);

    await expect(useCase.execute({
      paiementId: 'paiement-normal',
      rembourseurId: 'intendant-1',
      schoolId: 'school-1',
      action: 'REMBOURSER',
    })).rejects.toThrow('caution');
  });

  it('devrait rejeter si accès hors établissement', async () => {
    await expect(useCase.execute({
      paiementId: 'caution-1',
      rembourseurId: 'intendant-1',
      schoolId: 'autre-school',
      action: 'REMBOURSER',
    })).rejects.toThrow('Accès refusé');
  });
});
