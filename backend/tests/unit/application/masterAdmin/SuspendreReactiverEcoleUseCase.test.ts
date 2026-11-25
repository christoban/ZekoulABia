import { describe, it, expect, beforeEach } from 'bun:test';
import { SuspendreEcoleUseCase } from '../../../../src/application/masterAdmin/SuspendreEcoleUseCase.ts';
import { ReactiverEcoleUseCase } from '../../../../src/application/masterAdmin/ReactiverEcoleUseCase.ts';
import { InMemorySchoolRepository } from '../../../helpers/repositories/InMemorySchoolRepository.ts';
import { InMemoryInvitationRepository } from '../../../helpers/repositories/InMemoryInvitationRepository.ts';
import { School } from '@domain/entities/School';

describe('SuspendreEcoleUseCase', () => {
  let schoolRepo: InMemorySchoolRepository;
  let invitationRepo: InMemoryInvitationRepository;
  let useCase: SuspendreEcoleUseCase;

  const ecoleActive = School.reconstituer({
    id: 'school-1',
    name: 'Lycée Test',
    subdomain: 'lycee-test',
    status: 'ACTIVE',
    plan: 'STANDARD',
    subsystem: 'FRANCOPHONE',
    educationType: 'GENERAL',
    ownership: 'PRIVATE_SECULAR',
    saturdaySchedule: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  beforeEach(() => {
    schoolRepo = new InMemorySchoolRepository();
    invitationRepo = new InMemoryInvitationRepository();
    useCase = new SuspendreEcoleUseCase(schoolRepo, invitationRepo);
    schoolRepo.ajouter(ecoleActive);
  });

  it('devrait suspendre une école active', async () => {
    await useCase.execute('school-1');
    const ecole = await schoolRepo.findById('school-1');
    expect(ecole?.status).toBe('SUSPENDED');
  });

  it("devrait rejeter si l'école n'est pas active", async () => {
    const ecolePending = School.reconstituer({
      ...ecoleActive.toObject(),
      id: 'school-pending',
      status: 'PENDING',
    });
    schoolRepo.ajouter(ecolePending);

    await expect(useCase.execute('school-pending')).rejects.toThrow();
  });

  it("devrait rejeter si l'école est introuvable", async () => {
    await expect(useCase.execute('inexistant')).rejects.toThrow('introuvable');
  });
});

describe('ReactiverEcoleUseCase', () => {
  let schoolRepo: InMemorySchoolRepository;
  let useCase: ReactiverEcoleUseCase;

  beforeEach(() => {
    schoolRepo = new InMemorySchoolRepository();
    useCase = new ReactiverEcoleUseCase(schoolRepo);
  });

  it('devrait réactiver une école suspendue', async () => {
    const ecoleSuspendue = School.reconstituer({
      id: 'school-sus',
      name: 'Test',
      subdomain: 'test',
      status: 'SUSPENDED',
      plan: 'STANDARD',
      subsystem: 'FRANCOPHONE',
      educationType: 'GENERAL',
      ownership: 'PUBLIC',
      saturdaySchedule: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    schoolRepo.ajouter(ecoleSuspendue);

    await useCase.execute('school-sus');
    const ecole = await schoolRepo.findById('school-sus');
    expect(ecole?.status).toBe('ACTIVE');
  });

  it('devrait repasser en PENDING une école REJECTED', async () => {
    const ecoleRejetee = School.reconstituer({
      id: 'school-rej',
      name: 'Test',
      subdomain: 'test2',
      status: 'REJECTED',
      plan: 'DISCOVERY',
      subsystem: 'ANGLOPHONE',
      educationType: 'GENERAL',
      ownership: 'PRIVATE_SECULAR',
      saturdaySchedule: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    schoolRepo.ajouter(ecoleRejetee);

    await useCase.execute('school-rej');
    const ecole = await schoolRepo.findById('school-rej');
    expect(ecole?.status).toBe('PENDING');
  });
});
