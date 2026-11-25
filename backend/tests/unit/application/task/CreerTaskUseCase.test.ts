import { describe, it, expect, beforeEach } from 'bun:test';
import { CreerTaskUseCase } from '../../../../src/application/task/CreerTaskUseCase.ts';
import { InMemoryTaskRepository } from '../../../helpers/repositories/InMemoryTaskRepository.ts';
import { InMemoryUserRepository } from '../../../helpers/repositories/InMemoryUserRepository.ts';
import { User } from '@domain/entities/User';

describe('CreerTaskUseCase — tâche administrative', () => {
  let taskRepo: InMemoryTaskRepository;
  let userRepo: InMemoryUserRepository;
  let useCase: CreerTaskUseCase;

  const chefEtablissement = User.reconstituer({
    id: 'chef-1',
    schoolId: 'school-1',
    role: 'ADMIN',
    email: 'chef@test.cm',
    firstName: 'Chef',
    lastName: 'Principal',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    staffPermissions: [],
  });

  const censeur = User.reconstituer({
    id: 'censeur-1',
    schoolId: 'school-1',
    role: 'STAFF',
    email: 'censeur@test.cm',
    firstName: 'Jean',
    lastName: 'Censeur',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    staffPermissions: [],
  });

  const censeurAutreEcole = User.reconstituer({
    id: 'censeur-2',
    schoolId: 'school-2',
    role: 'STAFF',
    email: 'censeur2@test.cm',
    firstName: 'Autre',
    lastName: 'Ecole',
    isActive: true,
    refreshTokenVersion: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    staffPermissions: [],
  });

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepository();
    userRepo = new InMemoryUserRepository();
    userRepo.ajouter(chefEtablissement);
    userRepo.ajouter(censeur);
    userRepo.ajouter(censeurAutreEcole);
    useCase = new CreerTaskUseCase(taskRepo, userRepo);
  });

  it('devrait créer une tâche assignée à un membre du personnel', async () => {
    const resultat = await useCase.execute({
      schoolId: 'school-1',
      title: 'Lister les élèves sous 10 de moyenne',
      description: 'Pour vendredi',
      assignedById: 'chef-1',
      assignedToId: 'censeur-1',
    });

    expect(resultat.taskId).toBeDefined();
    expect(taskRepo.compter()).toBe(1);
    const task = await taskRepo.findById(resultat.taskId, 'school-1');
    expect(task?.status).toBe('A_FAIRE');
    expect(task?.assignedToId).toBe('censeur-1');
  });

  it('devrait rejeter si le responsable appartient à une autre école (isolation tenant)', async () => {
    await expect(useCase.execute({
      schoolId: 'school-1',
      title: 'Tâche interdite',
      assignedById: 'chef-1',
      assignedToId: 'censeur-2',
    })).rejects.toThrow("n'appartient pas");
    expect(taskRepo.compter()).toBe(0);
  });

  it('devrait rejeter si le responsable nexiste pas', async () => {
    await expect(useCase.execute({
      schoolId: 'school-1',
      title: 'Tâche orpheline',
      assignedById: 'chef-1',
      assignedToId: 'inconnu-1',
    })).rejects.toThrow('Responsable introuvable');
    expect(taskRepo.compter()).toBe(0);
  });

  it('devrait rejeter un titre vide', async () => {
    await expect(useCase.execute({
      schoolId: 'school-1',
      title: '   ',
      assignedById: 'chef-1',
      assignedToId: 'censeur-1',
    })).rejects.toThrow('titre');
    expect(taskRepo.compter()).toBe(0);
  });
});