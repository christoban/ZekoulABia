import type { SectionRepository } from '@domain/ports/repositories/SectionRepository';

export class InMemorySectionRepository implements SectionRepository {
  private store = new Map<
    string,
    {
      id: string;
      schoolId: string;
      code: string;
    }
  >();

  set(section: {
    id: string;
    schoolId: string;
    code: string;
  }): void {
    this.store.set(section.id, section);
  }

  async findById(id: string) {
    return this.store.get(id) ?? null;
  }
}