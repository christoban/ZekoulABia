/**
 * DOMAIN LAYER — Port Repository Santé Élève
 * Lecture des données nécessaires au calcul de l'indice de santé.
 */
export interface DonneesSanteEleve {
  studentId: string;
  // Notes
  moyenneGenerale: number;     // /20
  // Assiduité
  joursPresent: number;
  joursTotaux: number;
  // Tendance (3 dernières périodes)
  moyennesPrecedentes: number[]; // [periode-2, periode-1, periode-actuelle]
  // Comportement
  nombreSanctions: number;
  nombrePeriodes: number;
  // Paiements
  fraisRegles: number;         // montant payé
  fraisTotaux: number;         // montant total dû
}

export interface SanteEleveRepository {
  getDonneesSante(
    studentId: string,
    schoolId: string,
    academicYearId: string
  ): Promise<DonneesSanteEleve | null>;

  sauvegarderScore(studentId: string, score: number): Promise<void>;
}
