import type {
  SanteEleveRepository,
  DonneesSanteEleve,
} from '@domain/ports/repositories/SanteEleveRepository';

interface DonneesSanteStockees {
  schoolId: string;
  academicYearId: string;
  donnees: DonneesSanteEleve;
}

export class InMemorySanteEleveRepository implements SanteEleveRepository {
  private donnees = new Map<string, DonneesSanteStockees>();
  scoresEnregistres = new Map<string, number>();

  definir(studentId: string, schoolId: string, academicYearId: string, donnees: DonneesSanteEleve): void {
    this.donnees.set(studentId, { schoolId, academicYearId, donnees });
  }

  async getDonneesSante(
    studentId: string,
    schoolId: string,
    yearId: string
  ): Promise<DonneesSanteEleve | null> {
    const entry = this.donnees.get(studentId);
    if (!entry || entry.schoolId !== schoolId || entry.academicYearId !== yearId) {
      return null;
    }
    return entry.donnees;
  }

  async sauvegarderScore(studentId: string, score: number): Promise<void> {
    this.scoresEnregistres.set(studentId, score);
  }
}
