/**
 * STATISTICS DOMAIN — Port de lecture des statistiques. Port en lecture seule : toute
 * l'agrégation (moyennes, maps, tris) reste dans la couche présentation (StatisticsController).
 * Le port ne fait que récupérer des données brutes (DTOs plats, jamais de types Prisma).
 */

export interface SequenceLight {
  id: string;
  name: string;
  orderIndex: number;
  academicPeriod: { name: string };
}

export interface GradeEvolutionRow {
  sequenceAverage: number | null;
  sequence: SequenceLight;
}

export interface ClassRow {
  id: string;
  name: string;
  level: string | null;
}

export interface ClassComparisonGradeRow {
  classId: string;
  studentId: string;
  sequenceAverage: number | null;
}

export interface StudentsLevelRow {
  enrollmentsYearScoped: { class: { level: string | null } | null }[];
}

export interface InvoicePayRow {
  studentId: string;
  status: string;
}

export interface TeacherRow {
  id: string;
  firstName: string;
  lastName: string;
}

export interface TeachingAssignmentRow {
  subjectId: string;
  classId: string;
  subject: { name: string; hoursPerWeek: number };
  class: { name: string };
}

export interface TeacherGradeRow {
  subjectId: string;
  classId: string;
  sequenceAverage: number | null;
}

export interface AttendanceRow {
  status: string;
  date: Date;
  classId: string;
  subjectId: string;
}

export interface StatisticsQueryRepository {
  /** Année académique en cours de l'établissement (id seul). */
  findCurrentAcademicYear(schoolId: string): Promise<{ id: string } | null>;

  /** Notes (moyenne séquence + libellés) — filtre facultatif classe/matière/élève. */
  findGradesEvolution(
    schoolId: string,
    academicYearId: string,
    f: { classId?: string; subjectId?: string; studentId?: string }
  ): Promise<GradeEvolutionRow[]>;

  /** Classes de l'établissement, éventuellement filtrées par niveau. */
  findClassesByLevel(schoolId: string, level?: string): Promise<ClassRow[]>;

  /** Notes brutes (classe/élève/moyenne) pour la comparaison de classes. */
  findGradesForClassComparison(
    schoolId: string,
    academicYearId: string,
    classIds: string[]
  ): Promise<ClassComparisonGradeRow[]>;

  /** Distribution par genre des élèves actifs. */
  findStudentsGenderDistribution(schoolId: string): Promise<{ gender: string | null }[]>;

  /** Distribution par niveau (via l'inscription de l'année en cours). */
  findStudentsLevelDistribution(schoolId: string): Promise<StudentsLevelRow[]>;

  /** Factures non annulées (élève/statut) — distribution par statut de paiement. */
  findInvoicesPaymentStatuses(schoolId: string): Promise<InvoicePayRow[]>;

  /** Enseignant de l'établissement (id + identité). */
  findTeacherById(schoolId: string, teacherId: string): Promise<TeacherRow | null>;

  /** Affectations d'enseignement (matière + classe) d'un enseignant. */
  findTeachingAssignmentsForTeacher(schoolId: string, teacherId: string): Promise<TeachingAssignmentRow[]>;

  /** Notes brutes d'un sous-ensemble matières/classes — performance enseignant. */
  findGradesForTeacherPerformance(
    schoolId: string,
    subjectIds: string[],
    classIds: string[]
  ): Promise<TeacherGradeRow[]>;

  /** Présences (statut/date/classe/matière) d'un enseignant. */
  findAttendanceForTeacher(schoolId: string, teacherId: string, classIds: string[]): Promise<AttendanceRow[]>;
}
