import { describe, it, expect, beforeEach } from 'bun:test';
import { MettreAJourStatutTaskUseCase } from '../../../../src/application/task/MettreAJourStatutTaskUseCase.ts';
import { InMemoryTaskRepository } from '../../../helpers/repositories/InMemoryTaskRepository.ts';
import { Task } from '@domain/entities/Task';

describe('MettreAJourStatutTaskUseCase — transitions de statut', () => {
  let taskRepo: InMemoryTaskRepository;
  let useCase: MettreAJourStatutTaskUseCase;

  const creerTacheAfaire = (id: string = 'task-1') =>
    Task.create({
      schoolId: 'school-1',
      title: 'Préparer le conseil',
      assignedById: 'chef-1',
      assignedToId: 'censeur-1',
    });

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepository();
    useCase = new MettreAJourStatutTaskUseCase(taskRepo);
  });

  it('devrait suivre la chaîne A_FAIRE → EN_COURS → TERMINE → VALIDE', async () => {
    const task = creerTacheAfaire();
    await taskRepo.save(task);
    const id = task.id;

    await useCase.execute({ taskId: id, schoolId: 'school-1', nouveauStatut: 'EN_COURS', acteurId: 'censeur-1' });
    expect((await taskRepo.findById(id, 'school-1'))?.status).toBe('EN_COURS');

    await useCase.execute({ taskId: id, schoolId: 'school-1', nouveauStatut: 'TERMINE', acteurId: 'censeur-1' });
    expect((await taskRepo.findById(id, 'school-1'))?.status).toBe('TERMINE');

    await useCase.execute({ taskId: id, schoolId: 'school-1', nouveauStatut: 'VALIDE', acteurId: 'chef-1' });
    expect((await taskRepo.findById(id, 'school-1'))?.status).toBe('VALIDE');
  });

  it('devrait rejeter une transition invalide (A_FAIRE → VALIDE)', async () => {
    const task = creerTacheAfaire();
    await taskRepo.save(task);

    await expect(useCase.execute({
      taskId: task.id,
      schoolId: 'school-1',
      nouveauStatut: 'VALIDE',
      acteurId: 'chef-1',
    })).rejects.toThrow('Transition de statut invalide');
    expect((await taskRepo.findById(task.id, 'school-1'))?.status).toBe('A_FAIRE');
  });

  it('devrait rejeter si la tâche nexiste pas dans cette école', async () => {
    await expect(useCase.execute({
      taskId: 'inconnue',
      schoolId: 'school-1',
      nouveauStatut: 'EN_COURS',
      acteurId: 'chef-1',
    })).rejects.toThrow('Tâche introuvable');
  });

  it('devrait rejeter si lacteur nest ni assigneur ni assigné', async () => {
    const task = creerTacheAfaire();
    await taskRepo.save(task);

    await expect(useCase.execute({
      taskId: task.id,
      schoolId: 'school-1',
      nouveauStatut: 'EN_COURS',
      acteurId: 'intrus-1',
    })).rejects.toThrow("Seul l'assigneur");
  });
});