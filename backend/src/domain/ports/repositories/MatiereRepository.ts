/**
 * DOMAIN LAYER — Port Repository Matiere (Subject)
 * Inclut la gestion des coefficients par niveau/série — règle MINESEC.
 */
export interface MatiereProps {
  id: string;
  schoolId: string;
  name: string;
  code?: string;
  coefficient: number;
  hoursPerWeek: number;
  subjectType: 'THEORETICAL' | 'PRACTICAL' | 'MIXED';
  groupKey?: string;
  groupLabel?: string;
  groupOrder?: number;
}

export interface CoefficientMatiere {
  subjectId: string;
  classLevel: string;
  serieCode?: string;
  coefficient: number;
  groupKey?: string;
  groupLabel?: string;
  groupOrder?: number;
}

export interface MatiereRepository {
  // Lecture
  findById(id: string): Promise<MatiereProps | null>;
  findBySchool(schoolId: string): Promise<MatiereProps[]>;
  findByEnseignant(teacherProfileId: string): Promise<MatiereProps[]>;
  findIdsLV2BySchool(schoolId: string): Promise<string[]>;
  /** Matières LV2 (langue vivante 2) d'un établissement, ordonnées par nom — TemplateController. */
  findLV2BySchool(schoolId: string): Promise<MatiereProps[]>;

  /**
   * Anti-doublon sur le code (si fourni).
   * excludeId : exclut la matière courante lors d'une modification.
   */
  existsByCode(schoolId: string, code: string, excludeId?: string): Promise<boolean>;

  // Coefficients MINESEC
  getCoefficientPourClasse(
    subjectId: string,
    classLevel: string,
    serieCode?: string
  ): Promise<number>;

  getCoefficientsBACParSerie(
    serieCode: string
  ): Promise<{ subjectName: string; coefficient: number }[]>;

  getCoefficients(schoolId: string, subjectId: string): Promise<CoefficientMatiere[]>;

  /**
   * Upsert des coefficients par niveau/série.
   * Remplace le pattern find-then-create N fois par un upsert en lot.
   */
  upsertCoefficients(schoolId: string, coefficients: CoefficientMatiere[]): Promise<void>;

  // Enseignant ↔ Matière
  estEnseignantAssigne(teacherProfileId: string, subjectId: string): Promise<boolean>;
  assignerEnseignant(teacherProfileId: string, subjectId: string): Promise<void>;
  retirerEnseignant(teacherProfileId: string, subjectId: string): Promise<void>;

  /**
   * Synchronise les enseignants d'une matière (delete-all + recreate).
   * Remplace le helper syncSubjectTeachers() du controller.
   * teacherUserIds : liste des userId (pas teacherProfileId).
   */
  syncEnseignants(subjectId: string, teacherUserIds: string[]): Promise<void>;

  // Écriture
  save(matiere: MatiereProps): Promise<void>;
  update(matiere: MatiereProps): Promise<void>;
  // Suppression douce (Couche 1) — pose deletedAt, ne touche plus aux données liées.
  delete(id: string, deletedById?: string): Promise<void>;
  restaurer(id: string): Promise<void>;

  /** Corbeille (Couche 1) — matières soft-deleted d'une école. */
  listerSupprimes(schoolId: string): Promise<Array<{ id: string; name: string; code: string | null; deletedAt: Date | null; deletedById: string | null }>>;
  trouverSupprime(id: string, schoolId: string): Promise<{ id: string } | null>;
}
