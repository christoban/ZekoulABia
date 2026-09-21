import { describe, it, expect, beforeEach } from 'bun:test';
import { ConsulterStatutFraisEleveUseCase } from './ConsulterStatutFraisEleveUseCase';
import { Facture } from '@domain/entities/Facture';
import type { FactureRepository } from '@domain/ports/repositories/FactureRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

describe('ConsulterStatutFraisEleveUseCase', () => {
  let useCase: ConsulterStatutFraisEleveUseCase;
  let mockUser: any;
  let mockFactures: Facture[];
  let paymentsMap: Record<string, number>;

  const mockFactureRepo: FactureRepository = {
    findById: async () => null,
    findByEleve: async () => mockFactures,
    findBySchool: async () => [],
    findByStatut: async () => [],
    findByClasse: async () => [],
    findByPlanFrais: async () => [],
    calculerTotalPayeAvecSucces: async (factureId: string) => paymentsMap[factureId] ?? 0,
    getElevesEnRetard: async () => [],
    aFactureImpayeeBloquante: async () => false,
    save: async () => {},
    update: async () => {},
    delete: async () => {},
  };

  const mockUserRepo: UserRepository = {
    findById: async (id: string) => (mockUser && mockUser.id === id ? mockUser : null),
    findByEmail: async () => null,
    findBySchool: async () => [],
    findByRole: async () => [],
    findByClass: async () => [],
    save: async () => {},
    update: async () => {},
    delete: async () => {},
  } as any;

  beforeEach(() => {
    mockUser = {
      id: 'student-123',
      schoolId: 'school-1',
      firstName: 'Paul',
      lastName: 'Biya',
      role: 'STUDENT',
    };
    mockFactures = [];
    paymentsMap = {};
    useCase = new ConsulterStatutFraisEleveUseCase(mockFactureRepo, mockUserRepo);
  });

  it('retourne AUCUN_FRAIS si aucune facture n’est enregistrée', async () => {
    const res = await useCase.execute({
      schoolId: 'school-1',
      studentId: 'student-123',
    });

    expect(res.statutGlobal).toBe('AUCUN_FRAIS');
    expect(res.totalDu).toBe(0);
    expect(res.totalPaye).toBe(0);
    expect(res.soldeRestant).toBe(0);
  });

  it('retourne A_JOUR si toutes les factures sont entièrement payées', async () => {
    const f1 = Facture.create({
      schoolId: 'school-1',
      studentId: 'student-123',
      amount: 50000,
      description: 'Tranche 1',
    });
    mockFactures = [f1];
    paymentsMap[f1.id] = 50000;

    const res = await useCase.execute({
      schoolId: 'school-1',
      studentId: 'student-123',
    });

    expect(res.statutGlobal).toBe('A_JOUR');
    expect(res.totalDu).toBe(50000);
    expect(res.totalPaye).toBe(50000);
    expect(res.soldeRestant).toBe(0);
  });

  it('retourne EN_RETARD si une facture impayée a dépassé son échéance', async () => {
    const datePassee = new Date();
    datePassee.setDate(datePassee.getDate() - 5);

    const f1 = Facture.create({
      schoolId: 'school-1',
      studentId: 'student-123',
      amount: 40000,
      dueDate: datePassee,
      description: 'Frais Inscription',
    });
    mockFactures = [f1];
    paymentsMap[f1.id] = 10000;

    const res = await useCase.execute({
      schoolId: 'school-1',
      studentId: 'student-123',
    });

    expect(res.statutGlobal).toBe('EN_RETARD');
    expect(res.soldeRestant).toBe(30000);
    expect(res.factures[0].estEnRetard).toBe(true);
  });

  it('interdit l’accès si l’élève appartient à un autre établissement', async () => {
    mockUser.schoolId = 'autre-ecole';

    await expect(
      useCase.execute({
        schoolId: 'school-1',
        studentId: 'student-123',
      })
    ).rejects.toThrow('Élève introuvable dans cet établissement');
  });
});
