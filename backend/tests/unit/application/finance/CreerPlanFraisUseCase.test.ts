import { describe, it, expect, beforeEach } from 'bun:test';
import { CreerPlanFraisUseCase } from '../../../../src/application/finance/CreerPlanFraisUseCase.ts';
import { InMemoryPlanFraisRepository } from '../../../helpers/repositories/InMemoryPlanFraisRepository.ts';
import { SeuilLegalDepasseError } from '@domain/errors/SeuilLegalDepasseError';

describe('CreerPlanFraisUseCase — Loi 3 Art. 48 MINESEC', () => {
  let repo: InMemoryPlanFraisRepository;
  let useCase: CreerPlanFraisUseCase;

  beforeEach(() => {
    repo = new InMemoryPlanFraisRepository();
    repo.definirSeuils(7500, 10000);
    useCase = new CreerPlanFraisUseCase(repo);
  });

  it('devrait créer un plan TUITION dans les limites légales', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      name: 'Frais de scolarité 2nde',
      amount: 9000,
      feeType: 'TUITION',
      demandeurRole: 'ADMIN',
    });

    expect(resultat.planId).toBeDefined();
    expect(resultat.amount).toBe(9000);
  });

  it('devrait bloquer un plan TUITION dépassant le seuil légal', async () => {
    await expect(useCase.execute({
      schoolId: 'school-1',
      name: 'Frais trop élevés',
      amount: 15000,
      feeType: 'TUITION',
      demandeurRole: 'ADMIN',
    })).rejects.toThrow(SeuilLegalDepasseError);
  });

  it('devrait autoriser un montant > seuil pour les frais non-TUITION', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      name: 'Frais BEPC',
      amount: 25000,
      feeType: 'EXAM',
      demandeurRole: 'ADMIN',
    });
    expect(resultat.planId).toBeDefined();
  });

  it('devrait appliquer le seuil premier cycle si level contient 6e', async () => {
    await expect(useCase.execute({
      schoolId: 'school-1',
      name: 'Frais 6e',
      amount: 8000,
      feeType: 'TUITION',
      level: '6e',
      demandeurRole: 'ADMIN',
    })).rejects.toThrow(SeuilLegalDepasseError);
  });

  it("message d'erreur Loi 3 doit mentionner le montant et le seuil", async () => {
    try {
      await useCase.execute({
        schoolId: 'school-1',
        name: 'Plan illégal',
        amount: 20000,
        feeType: 'TUITION',
        demandeurRole: 'ADMIN',
      });
      throw new Error('Aurait dû lever une erreur');
    } catch (error) {
      expect(error).toBeInstanceOf(SeuilLegalDepasseError);
      expect((error as Error).message).toContain('20000');
      expect((error as Error).message).toContain('10000');
    }
  });
});
