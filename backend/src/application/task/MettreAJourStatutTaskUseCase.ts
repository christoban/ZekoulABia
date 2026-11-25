import type { TaskStatus } from '@domain/entities/Task';
import type { TaskRepository } from '@domain/ports/repositories/TaskRepository';

export interface MettreAJourStatutTaskCommande {
  taskId: string;
  schoolId: string;
  nouveauStatut: TaskStatus;
  acteurId: string;
}

export class MettreAJourStatutTaskUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(commande: MettreAJourStatutTaskCommande): Promise<void> {
    const task = await this.taskRepository.findById(commande.taskId, commande.schoolId);
    if (!task) throw new Error('Tâche introuvable');

    // RBAC : seul l'assigneur ou l'assigné peut changer le statut
    if (task.assignedById !== commande.acteurId && task.assignedToId !== commande.acteurId) {
      throw new Error('Seul l\'assigneur ou le responsable peut modifier le statut');
    }

    task.changerStatut(commande.nouveauStatut);
    await this.taskRepository.update(task);
  }
}