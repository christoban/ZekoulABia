/**
 * DOMAIN LAYER — Port Repository Parent
 * Gère la relation parent ↔ enfant et les données agrégées pour le portail parent.
 */
export interface EnfantAvecStats {
  studentId: string;
  prenom: string;
  nom: string;
  classeNom?: string;
  classeId?: string;
  groupIds?: string[];
  tauxPresence: number;        // % (présent + retard) / total
  tauxPonctualite: number;     // % retards / total (séparé de l'absence)
  joursAbsent: number;
  derniereeMention?: string;   // Mention du dernier bulletin
  dernieereMoyenne?: number;   // Moyenne du dernier bulletin
  indiceSante?: number;        // healthScore 0-100
}

export interface ParentRepository {
  /**
   * Règle domaine centrale : vérifie que l'élève appartient au parent.
   * Lance une erreur si la relation n'existe pas.
   */
  verifierRelationEnfant(parentUserId: string, studentId: string): Promise<void>;

  /**
   * Retourne tous les enfants du parent avec leurs statistiques agrégées.
   */
  findEnfantsAvecStats(parentUserId: string, schoolId: string): Promise<EnfantAvecStats[]>;

  /**
   * Vérifie si un parent a accès à un élève donné (sans lever d'erreur).
   */
  aAccesEleve(parentUserId: string, studentId: string): Promise<boolean>;

  findStudentIdsByParent(parentUserId: string): Promise<string[]>;
}
