import { describe, it, expect, beforeEach } from 'bun:test';
import { ChangerStatutPlanFraisUseCase } from '../../../../src/application/finance/ChangerStatutPlanFraisUseCase.ts';
import { InMemoryPlanFraisRepository } from '../../../helpers/repositories/InMemoryPlanFraisRepository.ts';
import { PlanFrais } from '@domain/entities/PlanFrais';
import { TransitionStatutPlanFraisError } from '@domain/errors/TransitionStatutPlanFraisError';

describe('ChangerStatutPlanFraisUseCase — workflow V1.11', () => {
  let repo: InMemoryPlanFraisRepository;
  let useCase: ChangerStatutPlanFraisUseCase;

  function creerPlan(status: 'DRAFT' | 'PENDING_VALIDATION' | 'APPROVED' | 'PUBLISHED', schoolId = 'school-1') {
    const plan = PlanFrais.create({
      schoolId,
      name: 'Frais de scolarité',
      amount: 9000,
      feeType: 'TUITION',
      status,
    });
    repo.ajouter(plan);
    return plan;
  }

  beforeEach(() => {
    repo = new InMemoryPlanFraisRepository();
    useCase = new ChangerStatutPlanFraisUseCase(repo);
  });

  it('DRAFT → PENDING_VALIDATION autorisé', async () => {
    const plan = creerPlan('DRAFT');
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      feePlanId: plan.id,
      statutCible: 'PENDING_VALIDATION',
    });
    expect(resultat.status).toBe('PENDING_VALIDATION');
  });

  it('PENDING_VALIDATION → APPROVED autorisé', async () => {
    const plan = creerPlan('PENDING_VALIDATION');
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      feePlanId: plan.id,
      statutCible: 'APPROVED',
    });
    expect(resultat.status).toBe('APPROVED');
  });

  it('APPROVED → PUBLISHED autorisé (publication effective)', async () => {
    const plan = creerPlan('APPROVED');
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      feePlanId: plan.id,
      statutCible: 'PUBLISHED',
    });
    expect(resultat.status).toBe('PUBLISHED');
  });

  it('transition invalide (DRAFT → PUBLISHED direct) rejetée', async () => {
    const plan = creerPlan('DRAFT');
    await expect(useCase.execute({
      schoolId: 'school-1',
      feePlanId: plan.id,
      statutCible: 'PUBLISHED',
    })).rejects.toThrow(TransitionStatutPlanFraisError);
  });

  it('transition invalide (PUBLISHED → DRAFT) rejetée', async () => {
    const plan = creerPlan('PUBLISHED');
    await expect(useCase.execute({
      schoolId: 'school-1',
      feePlanId: plan.id,
      statutCible: 'DRAFT',
    })).rejects.toThrow(TransitionStatutPlanFraisError);
  });

  it('refuse un plan d\'une autre école (isolation multi-tenant)', async () => {
    const plan = creerPlan('DRAFT', 'school-A');
    await expect(useCase.execute({
      schoolId: 'school-B',
      feePlanId: plan.id,
      statutCible: 'PENDING_VALIDATION',
    })).rejects.toThrow("n'appartient pas à votre établissement");
  });

  it('refuse un plan introuvable', async () => {
    await expect(useCase.execute({
      schoolId: 'school-1',
      feePlanId: 'inconnu',
      statutCible: 'PENDING_VALIDATION',
    })).rejects.toThrow('introuvable');
  });
});