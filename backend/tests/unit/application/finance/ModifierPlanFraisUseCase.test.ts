import { describe, it, expect } from 'bun:test';
import { PlanFrais } from '@domain/entities/PlanFrais';
import { ModifierPlanFraisUseCase } from '@application/finance/ModifierPlanFraisUseCase';

describe('ModifierPlanFraisUseCase', () => {
  it('met à jour le montant et la description d’un plan et déclenche la facturation automatique à la publication', async () => {
    let savedPlan: PlanFrais | null = null;
    let autoFacturationAppelee = false;

    const initialPlan = PlanFrais.create({
      schoolId: 'school-1',
      name: 'Frais de sport / activités',
      amount: 1, // initial dummy amount
      feeType: 'SPORTS_LEVY',
      description: 'Créé à la configuration — montant à définir',
      status: 'PUBLISHED',
    });

    const mockPlanFraisRepo = {
      findById: async (id: string) => (id === initialPlan.id ? initialPlan : null),
      update: async (p: PlanFrais) => { savedPlan = p; },
      updateStatus: async () => {},
      getSeuilLegalTuition: async () => 10000,
      save: async () => {},
      delete: async () => {},
      findBySchool: async () => [],
      findByType: async () => [],
      findByLevel: async () => [],
      findByAcademicYear: async () => [],
    };

    const mockGenererFactures = {
      execute: async (cmd: { schoolId: string; feePlanId: string }) => {
        if (cmd.feePlanId === initialPlan.id) {
          autoFacturationAppelee = true;
          return { crees: 25, ignores: 0, erreurs: [] };
        }
        return { crees: 0, ignores: 0, erreurs: [] };
      },
    } as any;

    const useCase = new ModifierPlanFraisUseCase(mockPlanFraisRepo as any, mockGenererFactures);

    const res = await useCase.execute({
      schoolId: 'school-1',
      demandeurRole: 'STAFF',
      feePlanId: initialPlan.id,
      amount: 5000,
      description: 'Cotisation sportive annuelle 2026-2027',
      status: 'PUBLISHED',
    });

    expect(res.amount).toBe(5000);
    expect(res.facturesGenerees).toBe(25);
    expect(autoFacturationAppelee).toBe(true);
    expect(savedPlan).not.toBeNull();
    expect(savedPlan!.amount).toBe(5000);
    expect(savedPlan!.toObject().description).toBe('Cotisation sportive annuelle 2026-2027');
  });

  it('interdit un montant de 0 FCFA si le plan est au statut PUBLISHED', async () => {
    const initialPlan = PlanFrais.create({
      schoolId: 'school-1',
      name: 'Frais de sport',
      amount: 1000,
      feeType: 'SPORTS_LEVY',
      status: 'DRAFT',
    });

    const mockPlanFraisRepo = {
      findById: async () => initialPlan,
      update: async () => {},
      updateStatus: async () => {},
    };

    const useCase = new ModifierPlanFraisUseCase(mockPlanFraisRepo as any);

    expect(useCase.execute({
      schoolId: 'school-1',
      demandeurRole: 'ADMIN',
      feePlanId: initialPlan.id,
      amount: 0,
      status: 'PUBLISHED',
    })).rejects.toThrow('Le montant doit être supérieur à 0 pour un plan publié');
  });

  it('interdit à un non-ADMIN (Intendant/STAFF) de publier directement un plan non publié', async () => {
    const initialPlan = PlanFrais.create({
      schoolId: 'school-1',
      name: 'Frais de cantine',
      amount: 15000,
      feeType: 'SPORTS_LEVY',
      status: 'PENDING_VALIDATION',
    });

    const mockPlanFraisRepo = {
      findById: async () => initialPlan,
      update: async () => {},
      updateStatus: async () => {},
    };

    const useCase = new ModifierPlanFraisUseCase(mockPlanFraisRepo as any);

    await expect(useCase.execute({
      schoolId: 'school-1',
      demandeurRole: 'STAFF',
      feePlanId: initialPlan.id,
      amount: 15000,
      status: 'PUBLISHED',
    })).rejects.toThrow("Seul l'administrateur (Direction) est habilité à valider et publier un plan de frais");
  });

  it('autorise un non-ADMIN (Intendant/STAFF) à enregistrer en DRAFT ou PENDING_VALIDATION', async () => {
    let savedPlan: PlanFrais | null = null;
    const initialPlan = PlanFrais.create({
      schoolId: 'school-1',
      name: 'Frais de cantine',
      amount: 15000,
      feeType: 'SPORTS_LEVY',
      status: 'DRAFT',
    });

    const mockPlanFraisRepo = {
      findById: async () => initialPlan,
      update: async (p: PlanFrais) => { savedPlan = p; },
      updateStatus: async () => {},
    };

    const useCase = new ModifierPlanFraisUseCase(mockPlanFraisRepo as any);

    const res = await useCase.execute({
      schoolId: 'school-1',
      demandeurRole: 'STAFF',
      feePlanId: initialPlan.id,
      amount: 18000,
      status: 'PENDING_VALIDATION',
    });

    expect(res.status).toBe('PENDING_VALIDATION');
    expect(res.amount).toBe(18000);
    expect(savedPlan?.status).toBe('PENDING_VALIDATION');
  });
});

