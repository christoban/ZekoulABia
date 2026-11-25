/**
 * DOMAIN LAYER — Port Repository Grade (moteur orientation)
 * Requêtes de grades dédiées au moteur d'orientation : tendances par matière et
 * profondeur de données. Séparé de NoteRepository pour respecter l'ISP — le moteur
 * orientation n'a pas besoin des opérations CRUD notes existantes.
 */

export interface GradeTendanceEntry {
  subjectName: string;
  sequenceAverage: number;
  maxValue: number;
  orderIndex: number;
  yearStartTs: number;
}

export interface GradeOrientationRepository {
  /** Grades validées/verrouillées pour les matières données, triées par année + séquence. */
  findGradesPourTendances(schoolId: string, studentId: string, subjectNames: string[]): Promise<GradeTendanceEntry[]>;
  /** Premier grade validé/verrouillé de l'élève —用于 calculer la profondeur de données. */
  findEarliestGradeYearStart(schoolId: string, studentId: string): Promise<Date | null>;
  /** Existence d'au moins une note validée/verrouillée — seuil minimal avant génération. */
  hasValidatedGrade(schoolId: string, studentId: string): Promise<boolean>;
}
