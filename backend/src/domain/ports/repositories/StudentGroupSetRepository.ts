/**
 * DOMAIN LAYER — Port Repository StudentGroupSet
 * Dimension de subdivision des élèves (LV2, Programme, Sport...). Fiche de référence simple,
 * sans logique métier propre — pattern props-only comme MatiereRepository, pas d'entité riche.
 */
export interface StudentGroupSetProps {
  id: string;
  schoolId: string;
  code: string;
  name: string;
}

export interface StudentGroupSetRepository {
  findById(id: string): Promise<StudentGroupSetProps | null>;
  findBySchool(schoolId: string): Promise<StudentGroupSetProps[]>;
  findByCode(schoolId: string, code: string): Promise<StudentGroupSetProps | null>;

  /** excludeId : exclut le GroupSet courant lors d'une modification. */
  existsByCode(schoolId: string, code: string, excludeId?: string): Promise<boolean>;

  save(groupSet: StudentGroupSetProps): Promise<void>;
  update(groupSet: StudentGroupSetProps): Promise<void>;
  delete(id: string): Promise<void>;
}
