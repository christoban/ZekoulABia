import { Task } from '@domain/entities/Task';
import type { TaskStatus } from '@domain/entities/Task';
import type { TaskRepository } from '@domain/ports/repositories/TaskRepository';

export class InMemoryTaskRepository implements TaskRepository {
  private store = new Map<string, Task>();

  compter(): number {
    return this.store.size;
  }

  async findById(id: string, schoolId: string): Promise<Task | null> {
    const task = this.store.get(id);
    return task && task.schoolId === schoolId ? task : null;
  }

  async findByAssignedTo(assignedToId: string, schoolId: string): Promise<Task[]> {
    return [...this.store.values()]
      .filter(t => t.assignedToId === assignedToId && t.schoolId === schoolId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async findBySchool(schoolId: string, status?: TaskStatus): Promise<Task[]> {
    return [...this.store.values()]
      .filter(t => t.schoolId === schoolId && (!status || t.status === status))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async save(task: Task): Promise<void> {
    this.store.set(task.id, task);
  }

  async update(task: Task): Promise<void> {
    this.store.set(task.id, task);
  }

  async delete(id: string, schoolId: string): Promise<void> {
    const task = this.store.get(id);
    if (task && task.schoolId === schoolId) this.store.delete(id);
  }
}