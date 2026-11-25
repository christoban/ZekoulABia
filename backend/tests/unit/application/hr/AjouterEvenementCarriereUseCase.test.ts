import { describe, it, expect, beforeEach } from 'bun:test';
import { AjouterEvenementCarriereUseCase } from '../../../../src/application/hr/AjouterEvenementCarriereUseCase';
import { ListerEvenementsCarriereUseCase } from '../../../../src/application/hr/ListerEvenementsCarriereUseCase';

class FakeCareerEventRepository {
  events: any[] = [];
  async create(data: any) {
    const event = { id: `evt-${this.events.length + 1}`, ...data, createdAt: new Date() };
    this.events.push(event);
    return event;
  }
  async findByUserOrdered(userId: string, schoolId: string) {
    return this.events.filter(e => e.userId === userId && e.schoolId === schoolId);
  }
  async findByUser() { return []; }
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

describe('AjouterEvenementCarriereUseCase', () => {
  let careerRepo: FakeCareerEventRepository;
  let userRepo: FakeUserRepository;
  let useCase: AjouterEvenementCarriereUseCase;

  beforeEach(() => {
    careerRepo = new FakeCareerEventRepository();
    userRepo = new FakeUserRepository();
    userRepo.setEmployee('emp-1', 'school-1', true);
    useCase = new AjouterEvenementCarriereUseCase(careerRepo as any, userRepo as any);
  });

  it('cas nominal — crée un événement', async () => {
    const result = await useCase.execute({
      schoolId: 'school-1',
      demandeurId: 'admin-1',
      userId: 'emp-1',
      type: 'PROMOTION',
      date: new Date('2024-06-15'),
      observation: 'Belle progression',
    });
    expect(result.event.type).toBe('PROMOTION');
    expect(careerRepo.events).toHaveLength(1);
  });

  it('employé introuvable → throw introuvable', async () => {
    await expect(
      useCase.execute({
        schoolId: 'school-1',
        demandeurId: 'admin-1',
        userId: 'inconnu',
        type: 'PROMOTION',
        date: new Date(),
      }),
    ).rejects.toThrow('introuvable');
  });

  it('type manquant → throw requis', async () => {
    await expect(
      useCase.execute({
        schoolId: 'school-1',
        demandeurId: 'admin-1',
        userId: 'emp-1',
        type: '',
        date: new Date(),
      }),
    ).rejects.toThrow('requis');
  });

  it('date manquante → throw requis', async () => {
    await expect(
      useCase.execute({
        schoolId: 'school-1',
        demandeurId: 'admin-1',
        userId: 'emp-1',
        type: 'PROMOTION',
        date: new Date(''),
      }),
    ).rejects.toThrow('requis');
  });
});

describe('ListerEvenementsCarriereUseCase', () => {
  let careerRepo: FakeCareerEventRepository;
  let userRepo: FakeUserRepository;
  let useCase: ListerEvenementsCarriereUseCase;

  beforeEach(() => {
    careerRepo = new FakeCareerEventRepository();
    userRepo = new FakeUserRepository();
    userRepo.setEmployee('emp-1', 'school-1', true);
    useCase = new ListerEvenementsCarriereUseCase(careerRepo as any, userRepo as any);
  });

  it('cas nominal — liste les événements', async () => {
    await careerRepo.create({ userId: 'emp-1', schoolId: 'school-1', type: 'PROMOTION', date: new Date() });
    const result = await useCase.execute({ schoolId: 'school-1', demandeurId: 'admin-1', userId: 'emp-1' });
    expect(result.events).toHaveLength(1);
  });

  it('employé introuvable → throw introuvable', async () => {
    await expect(
      useCase.execute({ schoolId: 'school-1', demandeurId: 'admin-1', userId: 'inconnu' }),
    ).rejects.toThrow('introuvable');
  });
});
