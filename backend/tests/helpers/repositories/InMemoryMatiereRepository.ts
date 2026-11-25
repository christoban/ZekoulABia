import type {
  MatiereRepository,
  MatiereProps,
  CoefficientMatiere,
} from '@domain/ports/repositories/MatiereRepository';

export class InMemoryMatiereRepository implements MatiereRepository {
  private store = new Map<string, MatiereProps>();
  private assignments = new Set<string>();
  private lv2SubjectIds = new Set<string>();

  setLV2SubjectIds(ids: string[]): void {
    this.lv2SubjectIds = new Set(ids);
  }

  private coefficients: {
    schoolId: string;
    coefficient: CoefficientMatiere;
  }[] = [];

  private bacCoefficients: {
    serieCode: string;
    subjectName: string;
    coefficient: number;
  }[] = [];

  syncAppels: { subjectId: string; teacherUserIds: string[] }[] = [];

  ajouter(matiere: MatiereProps): void {
    this.store.set(matiere.id, matiere);
  }

  ajouterBACCoefficient(
    serieCode: string,
    subjectName: string,
    coefficient: number
  ): void {
    this.bacCoefficients.push({
      serieCode,
      subjectName,
      coefficient,
    });
  }

  async findById(id: string): Promise<MatiereProps | null> {
    return this.store.get(id) ?? null;
  }

  async findBySchool(schoolId: string): Promise<MatiereProps[]> {
    return [...this.store.values()].filter(m => m.schoolId === schoolId);
  }

  async findByEnseignant(teacherProfileId: string): Promise<MatiereProps[]> {
    const subjectIds = [...this.assignments]
      .filter(key => key.startsWith(`${teacherProfileId}:`))
      .map(key => key.split(':')[1]);

    return [...this.store.values()].filter(m => subjectIds.includes(m.id));
  }

  async findIdsLV2BySchool(schoolId: string): Promise<string[]> {
    return [...this.store.values()]
      .filter(matiere => matiere.schoolId === schoolId)
      .filter(matiere => this.lv2SubjectIds.has(matiere.id))
      .map(matiere => matiere.id);
  }

  async findLV2BySchool(schoolId: string): Promise<MatiereProps[]> {
    return (await this.findBySchool(schoolId))
      .filter(matiere => this.lv2SubjectIds.has(matiere.id))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getCoefficientPourClasse(
    subjectId: string,
    classLevel: string,
    serieCode?: string
  ): Promise<number> {
    const coefficient = this.coefficients.find(
      entry =>
        entry.coefficient.subjectId === subjectId &&
        entry.coefficient.classLevel === classLevel &&
        entry.coefficient.serieCode === serieCode
    );

    if (coefficient) {
      return coefficient.coefficient.coefficient;
    }

    return this.store.get(subjectId)?.coefficient ?? 1;
  }

  async getCoefficientsBACParSerie(
    serieCode: string
  ): Promise<{ subjectName: string; coefficient: number }[]> {
    return this.bacCoefficients
      .filter(coefficient => coefficient.serieCode === serieCode)
      .map(({ subjectName, coefficient }) => ({
        subjectName,
        coefficient,
      }));
  }

  async estEnseignantAssigne(
    teacherProfileId: string,
    subjectId: string
  ): Promise<boolean> {
    return this.assignments.has(`${teacherProfileId}:${subjectId}`);
  }

  async existsByCode(
    schoolId: string,
    code: string,
    excludeId?: string
  ): Promise<boolean> {
    return [...this.store.values()].some(
      m => m.schoolId === schoolId && m.code === code && m.id !== excludeId
    );
  }

  async getCoefficients(
    schoolId: string,
    subjectId: string
  ): Promise<CoefficientMatiere[]> {
    return this.coefficients
      .filter(
        entry =>
          entry.schoolId === schoolId &&
          entry.coefficient.subjectId === subjectId
      )
      .map(entry => entry.coefficient);
  }

  async upsertCoefficients(
    schoolId: string,
    coefficients: CoefficientMatiere[]
  ): Promise<void> {
    for (const coefficient of coefficients) {
      const index = this.coefficients.findIndex(
        existing =>
          existing.schoolId === schoolId &&
          existing.coefficient.subjectId === coefficient.subjectId &&
          existing.coefficient.classLevel === coefficient.classLevel &&
          existing.coefficient.serieCode === coefficient.serieCode
      );

      const entry = {
        schoolId,
        coefficient,
      };

      if (index >= 0) {
        this.coefficients[index] = entry;
      } else {
        this.coefficients.push(entry);
      }
    }
  }

  async retirerEnseignant(
    teacherProfileId: string,
    subjectId: string
  ): Promise<void> {
    this.assignments.delete(`${teacherProfileId}:${subjectId}`);
  }

  async syncEnseignants(
    subjectId: string,
    teacherUserIds: string[]
  ): Promise<void> {
    this.syncAppels.push({ subjectId, teacherUserIds });

    for (const key of [...this.assignments]) {
      if (key.endsWith(`:${subjectId}`)) {
        this.assignments.delete(key);
      }
    }

    for (const userId of teacherUserIds) {
      this.assignments.add(`${userId}:${subjectId}`);
    }
  }

  async save(matiere: MatiereProps): Promise<void> {
    this.store.set(matiere.id, matiere);
  }

  async update(matiere: MatiereProps): Promise<void> {
    this.store.set(matiere.id, matiere);
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async restaurer(_id: string): Promise<void> {}
  async listerSupprimes(_schoolId: string) { return []; }
  async trouverSupprime(_id: string, _schoolId: string): Promise<{ id: string } | null> { return null; }

  async assignerEnseignant(
    teacherProfileId: string,
    subjectId: string
  ): Promise<void> {
    this.assignments.add(`${teacherProfileId}:${subjectId}`);
  }
}
