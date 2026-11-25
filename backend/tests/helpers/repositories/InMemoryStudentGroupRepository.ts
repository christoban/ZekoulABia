import type { StudentGroupRepository, StudentGroupProps } from '@domain/ports/repositories/StudentGroupRepository';

export class InMemoryStudentGroupRepository implements StudentGroupRepository {
  private store = new Map<string, StudentGroupProps>();

  ajouter(g: StudentGroupProps): void { this.store.set(g.id, g); }

  async findById(id: string): Promise<StudentGroupProps | null> { return this.store.get(id) ?? null; }

  async findByGroupSet(groupSetId: string): Promise<StudentGroupProps[]> {
    return [...this.store.values()].filter(g => g.groupSetId === groupSetId);
  }

  async existsByName(groupSetId: string, name: string, excludeId?: string): Promise<boolean> {
    return [...this.store.values()].some(g => g.groupSetId === groupSetId && g.name === name && g.id !== excludeId);
  }

  async save(group: StudentGroupProps): Promise<void> { this.store.set(group.id, group); }
  async update(group: StudentGroupProps): Promise<void> { this.store.set(group.id, group); }
  async delete(id: string): Promise<void> { this.store.delete(id); }
}
