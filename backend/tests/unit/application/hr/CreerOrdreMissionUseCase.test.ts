import { describe, it, expect, beforeEach } from 'bun:test';
import { CreerOrdreMissionUseCase } from '../../../../src/application/hr/CreerOrdreMissionUseCase';

class FakeMissionOrderRepository {
  orders: any[] = [];
  async create(data: any) {
    const order = { id: `ord-${this.orders.length + 1}`, ...data, createdAt: new Date() };
    this.orders.push(order);
    return order;
  }
  async findByIdAndSchool() { return null; }
}

class FakeUserRepository {
  private employees = new Map<string, any>();
  setEmployee(userId: string, schoolId: string, exists = true) {
    if (exists) this.employees.set(`${userId}:${schoolId}`, { id: userId, schoolId });
    else this.employees.delete(`${userId}:${schoolId}`);
  }
  async findEmployeeById(userId: string, schoolId: string) {
    return this.employees.get(`${userId}:${schoolId}`) ?? null;
  }
}

describe('CreerOrdreMissionUseCase', () => {
  let missionRepo: FakeMissionOrderRepository;
  let userRepo: FakeUserRepository;
  let useCase: CreerOrdreMissionUseCase;

  beforeEach(() => {
    missionRepo = new FakeMissionOrderRepository();
    userRepo = new FakeUserRepository();
    userRepo.setEmployee('emp-1', 'school-1', true);
    useCase = new CreerOrdreMissionUseCase(missionRepo as any, userRepo as any);
  });

  it('cas nominal — crée un ordre de mission', async () => {
    const result = await useCase.execute({
      schoolId: 'school-1',
      demandeurId: 'admin-1',
      userId: 'emp-1',
      motif: 'Formation',
      lieu: 'Yaoundé',
      dateDebut: new Date('2024-06-01'),
      dateFin: new Date('2024-06-05'),
      signataire: 'Proviseur',
    });
    expect(result.missionOrder.motif).toBe('Formation');
    expect(missionRepo.orders).toHaveLength(1);
  });

  it('employé introuvable → throw introuvable', async () => {
    await expect(
      useCase.execute({
        schoolId: 'school-1',
        demandeurId: 'admin-1',
        userId: 'inconnu',
        motif: 'Formation',
        lieu: 'Yaoundé',
        dateDebut: new Date(),
        dateFin: new Date(),
      }),
    ).rejects.toThrow('introuvable');
  });

  it('champs requis manquants → throw requis', async () => {
    await expect(
      useCase.execute({
        schoolId: 'school-1',
        demandeurId: 'admin-1',
        userId: '',
        motif: '',
        lieu: '',
        dateDebut: new Date(''),
        dateFin: new Date(),
      } as any),
    ).rejects.toThrow('requis');
  });
});
