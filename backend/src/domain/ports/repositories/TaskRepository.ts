/**
 * DOMAIN LAYER — Port Repository Task
 * Toutes les méthodes prennent schoolId en paramètre obligatoire (isolation multi-tenant).
 */
import type { Task, TaskStatus } from '@domain/entities/Task';

export interface TaskRepository {
  findById(id: string, schoolId: string): Promise<Task | null>;
  findByAssignedTo(assignedToId: string, schoolId: string): Promise<Task[]>;
  findBySchool(schoolId: string, status?: TaskStatus): Promise<Task[]>;
  save(task: Task): Promise<void>;
  update(task: Task): Promise<void>;
  delete(id: string, schoolId: string): Promise<void>;
}