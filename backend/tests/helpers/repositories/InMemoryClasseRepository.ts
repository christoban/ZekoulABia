import { Classe } from '@domain/entities/Classe';
import type { ClasseRepository } from '@domain/ports/repositories/ClasseRepository';

export class InMemoryClasseRepository implements ClasseRepository {
  private store = new Map<string, Classe>();
  supprimerAppels: string[] = [];

  ajouter(c: Classe): void { this.store.set(c.id, c); }
  vider(): void { this.store.clear(); }

  async findById(id: string) { return this.store.get(id) ?? null; }
  async findBySchool(schoolId: string) {
    return [...this.store.values()].filter(c => c.schoolId === schoolId);
  }
  async findBySection(sectionId: string) {
    return [...this.store.values()].filter(c => c.sectionId === sectionId);
  }
  async findByLevel(schoolId: string, level: string) {
    return [...this.store.values()].filter(c => c.schoolId === schoolId && c.level === level);
  }
  async findBySchoolAndYear(schoolId: string, academicYearId: string) {
    return [...this.store.values()].filter(c => c.schoolId === schoolId && c.academicYearId === academicYearId);
  }
  async activerToutesDraft(schoolId: string, academicYearId: string) {
    const draftClasses = [...this.store.values()].filter(
      c => c.schoolId === schoolId && c.academicYearId === academicYearId && c.status === 'DRAFT'
    );
    for (const c of draftClasses) c.activer();
    return draftClasses.length;
  }
  async annulerPropositionAnnee(schoolId: string, academicYearId: string) {
    const draftClasses = [...this.store.values()].filter(
      c => c.schoolId === schoolId && c.academicYearId === academicYearId && c.status === 'DRAFT'
    );
    const ids = draftClasses.map(c => c.id);
    for (const id of ids) this.store.delete(id);
    return ids;
  }
  async countEleves(_classeId: string) { return 0; }
  async existsByName(schoolId: string, name: string, excludeId?: string) {
    return [...this.store.values()].some(
      c => c.schoolId === schoolId && c.name === name && c.id !== excludeId
    );
  }
  async save(c: Classe) { this.store.set(c.id, c); }
  async update(c: Classe) { this.store.set(c.id, c); }
  async delete(id: string) { this.store.delete(id); }
  async supprimerAvecCascade(classeId: string) {
    this.supprimerAppels.push(classeId);
    this.store.delete(classeId);
  }
  async restaurer(_classeId: string) {}
  async listerSupprimes(_schoolId: string) { return []; }
  async trouverSupprime(_id: string, _schoolId: string): Promise<{ id: string } | null> { return null; }
  async findClasseDeProfPrincipal(teacherUserId: string) {
    for (const c of this.store.values()) {
      if (c.professorPrincipalId === teacherUserId) return c;
    }
    return null;
  }
  async findByNameContient(_schoolId: string, _name: string) { return null; }
  async findElevesActifsPourTemplate(_schoolId: string, _classId: string) { return []; }
}
