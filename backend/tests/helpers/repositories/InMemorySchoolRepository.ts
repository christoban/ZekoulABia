import { School } from '@domain/entities/School';
import type { SchoolRepository } from '@domain/ports/repositories/SchoolRepository';
import type { SchoolStatus } from '@domain/types/enums';

export class InMemorySchoolRepository implements SchoolRepository {
  private store = new Map<string, School>();

  ajouter(school: School): void { this.store.set(school.id, school); }
  vider(): void { this.store.clear(); }

  async findById(id: string) { return this.store.get(id) ?? null; }
  async findBySubdomain(subdomain: string) {
    return [...this.store.values()].find(s => s.subdomain === subdomain) ?? null;
  }
  async findPEBSFlags(schoolId: string) {
    const s = this.store.get(schoolId);
    if (!s) return null;
    return { hasPEBSFrancophone: false, hasPEBSAnglophone: false };
  }
  async findAll() { return [...this.store.values()]; }
  async findByStatus(status: SchoolStatus) {
    return [...this.store.values()].filter(s => s.status === status);
  }
  async existsBySubdomain(subdomain: string) {
    return [...this.store.values()].some(s => s.subdomain === subdomain);
  }
  async save(school: School) { this.store.set(school.id, school); }
  async update(school: School) { this.store.set(school.id, school); }
  async delete(id: string) { this.store.delete(id); }
  async countByStatus(status: SchoolStatus) {
    return [...this.store.values()].filter(s => s.status === status).length;
  }
  async countEleves(_schoolId: string) { return 0; }
  async isEmailDigestAdminEnabled(_schoolId: string) { return false; }
  async updateAdminGereInscriptions(schoolId: string, adminGereInscriptions: boolean) {
    const s = this.store.get(schoolId);
    if (s) {
      const updated = School.reconstituer({
        ...s.toObject(),
        adminGereInscriptions,
        updatedAt: new Date(),
      });
      this.store.set(s.id, updated);
    }
  }
  async updateAdminGereFinances(schoolId: string, adminGereFinances: boolean) {
    const s = this.store.get(schoolId);
    if (s) {
      const updated = School.reconstituer({
        ...s.toObject(),
        adminGereFinances,
        updatedAt: new Date(),
      });
      this.store.set(s.id, updated);
    }
  }
}
