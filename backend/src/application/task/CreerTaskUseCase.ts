import { Task } from '@domain/entities/Task';
import type { TaskRepository } from '@domain/ports/repositories/TaskRepository';
import type { UserRepository } from '@domain/ports/repositories/UserRepository';

export interface CreerTaskCommande {
  schoolId: string;
  title: string;
  description?: string;
  assignedById: string;
  assignedToId: string;
  dueDate?: Date;
  attachments?: string[];
}

export class CreerTaskUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(commande: CreerTaskCommande): Promise<{ taskId: string }> {
    if (!commande.title || commande.title.trim().length === 0) {
      throw new Error('Le titre de la tâche est requis');
    }

    // Isolation multi-tenant : l'assigné doit appartenir à la même école
    const assigne = await this.userRepository.findById(commande.assignedToId);
    if (!assigne) throw new Error('Responsable introuvable');
    if (assigne.schoolId !== commande.schoolId) {
      throw new Error('Le responsable n\'appartient pas à cet établissement');
    }

    const task = Task.create({
      schoolId: commande.schoolId,
      title: commande.title,
      description: commande.description,
      assignedById: commande.assignedById,
      assignedToId: commande.assignedToId,
      dueDate: commande.dueDate,
      attachments: commande.attachments,
    });

    await this.taskRepository.save(task);
    return { taskId: task.id };
  }
}