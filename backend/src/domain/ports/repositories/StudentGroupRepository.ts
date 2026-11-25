/**
 * DOMAIN LAYER — Port Repository StudentGroup
 * Valeur dans un StudentGroupSet (ex. "Allemand" dans "LV2"). Pattern props-only.
 */
export interface StudentGroupProps {
  id: string;
  groupSetId: string;
  name: string;
  subjectId?: string;
}

export interface StudentGroupRepository {
  findById(id: string): Promise<StudentGroupProps | null>;
  findByGroupSet(groupSetId: string): Promise<StudentGroupProps[]>;

  /** excludeId : exclut le Group courant lors d'une modification. */
  existsByName(groupSetId: string, name: string, excludeId?: string): Promise<boolean>;

  save(group: StudentGroupProps): Promise<void>;
  update(group: StudentGroupProps): Promise<void>;
  delete(id: string): Promise<void>;
}
