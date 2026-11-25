import type { Task, TaskStatus } from '@domain/entities/Task';
import type { TaskRepository } from '@domain/ports/repositories/TaskRepository';

export interface ListerTasksCommande {
  schoolId: string;
  scope: 'ECOLE' | 'PERSONNEL';
  userId: string;
  status?: TaskStatus;
}

export class ListerTasksUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(commande: ListerTasksCommande): Promise<Task[]> {
    if (commande.scope === 'PERSONNEL') {
      return this.taskRepository.findByAssignedTo(commande.userId, commande.schoolId);
    }
    return this.taskRepository.findBySchool(commande.schoolId, commande.status);
  }
}