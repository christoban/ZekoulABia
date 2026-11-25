/**
 * DOMAIN LAYER — Port Repository Sous-Groupe TP (ClassSubGroup)
 * Gère les groupes A/B pour les travaux pratiques.
 */
export interface SousGroupeProps {
  id: string;
  classId: string;
  name: string; // "Groupe A", "Groupe B"
}

export interface SousGroupeRepository {
  findById(id: string): Promise<SousGroupeProps | null>;
  findByClasse(classId: string): Promise<SousGroupeProps[]>;
  existsByName(classId: string, name: string): Promise<boolean>;
  save(sousGroupe: SousGroupeProps): Promise<void>;
  delete(id: string): Promise<void>;

  /**
   * Assigne des élèves à un sous-groupe.
   * skipDuplicates : ignore les élèves déjà dans ce groupe.
   * Vérifie multi-tenant via subGroup.class.schoolId.
   */
  assignerEleves(
    subGroupId: string,
    studentProfileIds: string[],
    schoolId: string
  ): Promise<void>;

  getElevesAssignes(subGroupId: string): Promise<string[]>; // studentProfileIds
}
