import { Depense } from '@domain/entities/Depense';
import type { DepenseRepository } from '@domain/ports/repositories/DepenseRepository';

export class InMemoryDepenseRepository implements DepenseRepository {
  private store = new Map<string, Depense>();

  async findById(id: string): Promise<Depense | null> {
    return this.store.get(id) ?? null;
  }

  async findBySchool(schoolId: string): Promise<Depense[]> {
    return [...this.store.values()].filter(
      depense => depense.schoolId === schoolId
    );
  }

  async findByCategorie(schoolId: string, categorie: string): Promise<Depense[]> {
    return [...this.store.values()].filter(
      depense =>
        depense.schoolId === schoolId &&
        depense.toObject().category === categorie
    );
  }

  async findByPeriode(schoolId: string, debut: Date, fin: Date): Promise<Depense[]> {
    return [...this.store.values()].filter(
      depense => {
        const data = depense.toObject();
        return (
          data.schoolId === schoolId &&
          data.date >= debut &&
          data.date <= fin
        );
      }
    );
  }

  async getTotalDepenses(schoolId: string, debut?: Date, fin?: Date): Promise<number> {
    return [...this.store.values()]
      .filter(depense => {
        const data = depense.toObject();
        if (data.schoolId !== schoolId) return false;
        if (debut && data.date < debut) return false;
        if (fin && data.date > fin) return false;
        return true;
      })
      .reduce((total, depense) => total + depense.amount, 0);
  }

  async save(depense: Depense): Promise<void> {
    this.store.set(depense.id, depense);
  }

  async update(depense: Depense): Promise<void> {
    this.store.set(depense.id, depense);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }
}
