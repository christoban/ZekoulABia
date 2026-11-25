import type { StudentGroupSetRepository, StudentGroupSetProps } from '@domain/ports/repositories/StudentGroupSetRepository';

export class InMemoryStudentGroupSetRepository implements StudentGroupSetRepository {
  private store = new Map<string, StudentGroupSetProps>();

  ajouter(g: StudentGroupSetProps): void { this.store.set(g.id, g); }

  async findById(id: string): Promise<StudentGroupSetProps | null> { return this.store.get(id) ?? null; }

  async findBySchool(schoolId: string): Promise<StudentGroupSetProps[]> {
    return [...this.store.values()].filter(g => g.schoolId === schoolId);
  }

  async findByCode(schoolId: string, code: string): Promise<StudentGroupSetProps | null> {
    return [...this.store.values()].find(g => g.schoolId === schoolId && g.code === code) ?? null;
  }

  async existsByCode(schoolId: string, code: string, excludeId?: string): Promise<boolean> {
    return [...this.store.values()].some(g => g.schoolId === schoolId && g.code === code && g.id !== excludeId);
  }

  async save(groupSet: StudentGroupSetProps): Promise<void> { this.store.set(groupSet.id, groupSet); }
  async update(groupSet: StudentGroupSetProps): Promise<void> { this.store.set(groupSet.id, groupSet); }
  async delete(id: string): Promise<void> { this.store.delete(id); }
}
