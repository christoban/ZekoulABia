/**
 * DOMAIN LAYER — Port Repository Dépense (Expense)
 */
import type { Depense } from '@domain/entities/Depense';

export interface DepenseRepository {
  findById(id: string): Promise<Depense | null>;
  findBySchool(schoolId: string): Promise<Depense[]>;
  findByCategorie(schoolId: string, categorie: string): Promise<Depense[]>;
  findByPeriode(schoolId: string, debut: Date, fin: Date): Promise<Depense[]>;
  getTotalDepenses(schoolId: string, debut?: Date, fin?: Date): Promise<number>;
  save(depense: Depense): Promise<void>;
  update(depense: Depense): Promise<void>;
  delete(id: string): Promise<void>;
}
