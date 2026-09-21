import { describe, it, expect, beforeEach } from 'bun:test';
import { GenererFacturesInscriptionAutomatiqueUseCase } from './GenererFacturesInscriptionAutomatiqueUseCase';
import { PlanFrais } from '@domain/entities/PlanFrais';
import { Facture } from '@domain/entities/Facture';
import { Classe } from '@domain/entities/Classe';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { PlanFraisRepository } from '@domain/ports/repositories/PlanFraisRepository';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

describe('GenererFacturesInscriptionAutomatiqueUseCase', () => {
  let useCase: GenererFacturesInscriptionAutomatiqueUseCase;
  let savedFactures: Facture[];
  let existingFactures: Facture[];
  let plans: PlanFrais[];
  let mockClasse: Classe | null;

  const mockFactureRepo: FactureRepository = {
    findById: async () => null,
    findByEleve: async (studentId: string) => existingFactures.filter((f) => f.studentId === studentId),
    findBySchool: async () => [],
    findByStatut: async () => [],
    findByClasse: async () => [],
    findByPlanFrais: async () => [],
    calculerTotalPayeAvecSucces: async () => 0,
    getElevesEnRetard: async () => [],
    aFactureImpayeeBloquante: async () => false,
    save: async (facture: Facture) => {
      savedFactures.push(facture);
      existingFactures.push(facture);
    },
    update: async () => {},
    delete: async () => {},
  };

  const mockPlanFraisRepo: PlanFraisRepository = {
    findById: async () => null,
    findBySchool: async () => plans,
    findByType: async () => [],
    findByLevel: async () => [],
    findByAcademicYear: async () => plans,
    getSeuilLegalTuition: async () => 50000,
    save: async () => {},
    update: async () => {},
    updateStatus: async () => {},
    delete: async () => {},
  };

  const mockClasseRepo: ClasseRepository = {
    findById: async () => mockClasse,
    findBySchool: async () => [],
    findBySection: async () => [],
    findByLevel: async () => [],
    findBySchoolAndYear: async () => [],
    countEleves: async () => 0,
    activerToutesDraft: async () => 0,
    annulerPropositionAnnee: async () => [],
    existsByName: async () => false,
    findClasseDeProfPrincipal: async () => null,
    findByNameContient: async () => null,
    save: async () => {},
    update: async () => {},
    supprimerAvecCascade: async () => {},
    restaurer: async () => {},
    listerSupprimes: async () => [],
    trouverSupprime: async () => null,
  };

  beforeEach(() => {
    savedFactures = [];
    existingFactures = [];
    plans = [];
    mockClasse = Classe.create({
      schoolId: 'school-1',
      academicYearId: 'year-1',
      name: '6e A',
      level: '6e',
    });

    useCase = new GenererFacturesInscriptionAutomatiqueUseCase(
      mockFactureRepo,
      mockPlanFraisRepo,
      mockClasseRepo,
    );
  });

  it('génère automatiquement les factures pour les plans TUITION et REGISTRATION publiés correspondant au niveau', async () => {
    plans = [
      PlanFrais.create({
        schoolId: 'school-1',
        name: 'Frais Inscription 6e',
        amount: 25000,
        feeType: 'INSCRIPTION',
        level: '6e',
        status: 'PUBLISHED',
      }),
      PlanFrais.create({
        schoolId: 'school-1',
        name: 'Scolarité Tranche 1',
        amount: 50000,
        feeType: 'TUITION',
        level: '6e',
        status: 'PUBLISHED',
      }),
      PlanFrais.create({
        schoolId: 'school-1',
        name: 'Scolarité Tle C',
        amount: 80000,
        feeType: 'TUITION',
        level: 'Tle',
        status: 'PUBLISHED',
      }),
      PlanFrais.create({
        schoolId: 'school-1',
        name: 'Plan Brouillon 6e',
        amount: 10000,
        feeType: 'TUITION',
        level: '6e',
        status: 'DRAFT',
      }),
    ];

    const res = await useCase.execute({
      schoolId: 'school-1',
      studentUserId: 'user-eleve-1',
      classId: 'class-6eA',
      academicYearId: 'year-1',
    });

    expect(res.facturesCrees).toBe(2);
    expect(res.ignores).toBe(0);
    expect(savedFactures.length).toBe(2);
    expect(savedFactures.some((f) => f.amount === 25000)).toBe(true);
    expect(savedFactures.some((f) => f.amount === 50000)).toBe(true);
  });

  it('est idempotent : ne recrée pas de facture si l’élève a déjà été facturé pour ce plan', async () => {
    const planRegistration = PlanFrais.create({
      schoolId: 'school-1',
      name: 'Frais Inscription 6e',
      amount: 25000,
      feeType: 'INSCRIPTION',
      level: '6e',
      status: 'PUBLISHED',
    });

    plans = [planRegistration];

    // Première exécution
    const res1 = await useCase.execute({
      schoolId: 'school-1',
      studentUserId: 'user-eleve-1',
      classId: 'class-6eA',
      academicYearId: 'year-1',
    });

    expect(res1.facturesCrees).toBe(1);
    expect(res1.ignores).toBe(0);

    // Seconde exécution (re-tentative ou événement dupliqué)
    const res2 = await useCase.execute({
      schoolId: 'school-1',
      studentUserId: 'user-eleve-1',
      classId: 'class-6eA',
      academicYearId: 'year-1',
    });

    expect(res2.facturesCrees).toBe(0);
    expect(res2.ignores).toBe(1);
    expect(savedFactures.length).toBe(1); // Pas de doublon
  });
});
