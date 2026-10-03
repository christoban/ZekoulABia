/**
 * DOMAIN LAYER — Port Repository Presence (Attendance)
 */
import type { Presence } from '@domain/entities/Presence';
import type { AttendanceStatus, AttendancePeriod } from '@domain/types/enums';

export interface StatistiquesPresence {
  totalJours: number;
  joursPresent: number;
  joursAbsent: number;
  joursRetard: number;
  tauxPresence: number; // pourcentage 0-100
}

/** Enregistrement de présence à synchroniser (SMS) — upsert dans l'adapter. */
export interface PresenceSmsRecord {
  schoolId: string;
  studentId: string;
  classId: string;
  date: Date;
  status: AttendanceStatus;
  period: AttendancePeriod;
  recordedById: string | null;
  teacherId: string | null;
}

/** Filtres de lecture des présences — routes lister / statistiques. */
export interface FiltrePresences {
  classId?: string;
  studentId?: string | string[];
  dateDebut?: Date;
  dateFin?: Date;
  status?: AttendanceStatus;
  since?: Date;
}

/** Présence enrichie de sa classe (id + nom) — route lister. */
export interface PresenceLue {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  academicPeriodId: string | null;
  subjectId: string | null;
  teacherId: string | null;
  recordedById: string | null;
  date: Date;
  status: AttendanceStatus;
  period: AttendancePeriod;
  isOfflineSync: boolean;
  createdAt: Date;
  class: { id: string; name: string } | null;
}

/** Présence justifiée, enrichie de l'élève et de la classe — route justifierAbsence. */
export interface PresenceJustifiee extends PresenceLue {
  student: { id: string; firstName: string; lastName: string } | null;
}

export interface PresenceRepository {
  // Lecture
  findById(id: string): Promise<Presence | null>;
  findByEleve(studentId: string, academicPeriodId: string): Promise<Presence[]>;
  findByClasse(classId: string, date: Date, period: AttendancePeriod): Promise<Presence[]>;
  findByClasseEtPeriode(classId: string, academicPeriodId: string): Promise<Presence[]>;

  // Comptages pour les alertes (Loi absences)
  countAbsencesNonJustifiees(studentId: string, academicPeriodId: string): Promise<number>;
  countAbsencesConsecutives(studentId: string): Promise<number>;

  // Stats pour dashboard et bulletins
  getStatistiquesEleve(studentId: string, academicPeriodId: string): Promise<StatistiquesPresence>;

  // Vérifier si une présence existe déjà (éviter les doublons)
  existeDeja(studentId: string, date: Date, period: AttendancePeriod): Promise<boolean>;

  // Écriture
  save(presence: Presence): Promise<void>;
  saveMany(presences: Presence[]): Promise<void>; // Enregistrement en bloc d'une classe
  update(presence: Presence): Promise<void>;

  /** Upsert d'enregistrements de présence (SMS) : crée ou met à jour selon l'existant. */
  synchroniserPresencesSms(records: PresenceSmsRecord[]): Promise<void>;

  // Inngest — bulletins : ABSENT + LATE
  countAbsencesEtRetards(schoolId: string, studentId: string, academicPeriodId: string): Promise<number>;

  // T7/T8/T9 — taux de présence sur fenêtre de dates libre (copilot) — début du mois courant
  compterPresencesDepuis(filtre: {
    schoolId: string;
    classId?: string;
    teacherId?: string;
    studentId?: string;
    depuis: Date;
  }): Promise<{ present: number; total: number }>;

  // Classe — liste élèves avec taux de présence
  findByClasseEtEleves(classId: string, studentIds: string[]): Promise<Array<{ studentId: string; status: string }>>;

  // Sync hors ligne
  findPresencesHorsLigneEnAttente(userId: string): Promise<Presence[]>;

  // --- Routes HTTP de lecture (lister / justifier / statistiques) ---

  /** Présence enrichie de sa classe (id + nom) — pour la route lister. */
  findAvecClasse(
    params: { schoolId: string; filtre: FiltrePresences; skip: number; take: number },
  ): Promise<PresenceLue[]>;

  /** Comptage par filtre — pour lister et statistiques. */
  countByFiltre(schoolId: string, filtre: FiltrePresences): Promise<number>;

  /** Recherche scopée à l'établissement — pour justifierAbsence. */
  findByIdDansEcole(schoolId: string, id: string): Promise<Presence | null>;

  /** Justification d'une absence, retourne l'enregistrement mis à jour enrichi. */
  justifierAbsence(
    schoolId: string,
    id: string,
    data: { justification?: string; justifiedById: string; justifiedAt: Date },
  ): Promise<PresenceJustifiee | null>;
}
