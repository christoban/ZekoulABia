/**
 * DOMAIN LAYER — Port Repository Presence (Attendance)
 */
import type { Presence } from '@domain/entities/Presence';
import type { AttendanceStatus, AttendancePeriod, JustificationStatus } from '@domain/types/enums';

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
  period?: AttendancePeriod;
  subjectId?: string;
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
  arrivedAt: Date | null;
  lateNote: string | null;
  justification: string | null;
  justificationStatus: JustificationStatus | null;
  justificationAttachmentUrl: string | null;
  submittedByParentId: string | null;
  previousStatus: AttendanceStatus | null;
  updatedById: string | null;
  updatedAt: Date | null;
  clientRecordedAt: Date | null;
  clockSkewSeconds: number | null;
  isOfflineSync: boolean;
  createdAt: Date;
  class: { id: string; name: string } | null;
}

/** Présence justifiée, enrichie de l'élève et de la classe — route justifierAbsence. */
export interface PresenceJustifiee extends PresenceLue {
  student: { id: string; firstName: string; lastName: string } | null;
}

/** Statut de l'appel du jour par classe — Dashboard Direction / Censeur / Surveillant. */
export interface DailyClassAttendanceStatus {
  classId: string;
  className: string;
  level: string | null;
  studentCount: number;
  recordedCount: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  isDone: boolean;
  recordedAt: Date | null;
  recordedBy: { id: string; firstName: string; lastName: string } | null;
}

/** Élève avec absences répétées dépassant le seuil configuré. */
export interface RepeatedAbsenceStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  classId: string;
  className: string;
  unjustifiedCount: number;
  justifiedCount: number;
  totalAbsences: number;
  lastAbsenceDate: Date | null;
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
  upsertMany(presences: Presence[], updatedById: string): Promise<Presence[]>;
  update(presence: Presence): Promise<void>;

  /** Correction post-validation tracée d'un enregistrement individuel. */
  correctStatus(
    schoolId: string,
    id: string,
    data: { status: AttendanceStatus; arrivedAt?: Date | null; lateNote?: string | null; updatedById: string },
  ): Promise<PresenceLue | null>;

  /** Soumission d'un justificatif par un parent (reste en PENDING jusqu'à validation staff/admin). */
  submitParentJustification(
    schoolId: string,
    id: string,
    data: { parentUserId: string; justification: string; attachmentUrl?: string | null },
  ): Promise<PresenceJustifiee | null>;

  /** Upsert d'enregistrements de présence (SMS) : crée ou met à jour selon l'existant. */
  synchroniserPresencesSms(records: PresenceSmsRecord[]): Promise<void>;

  // Inngest — bulletins : ABSENT + ABSENT_JUSTIFIED
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

  // Direction / Surveillant : suivi journalier des appels faits / non faits + absences répétées
  getDailyClassStatus(schoolId: string, date: Date, period?: AttendancePeriod): Promise<DailyClassAttendanceStatus[]>;
  getRepeatedAbsences(schoolId: string, minAbsences: number, sinceDate: Date): Promise<RepeatedAbsenceStudent[]>;

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

  /** Justification / validation ou rejet d'une absence, retourne l'enregistrement mis à jour enrichi. */
  justifierAbsence(
    schoolId: string,
    id: string,
    data: { justification?: string; justifiedById: string; justifiedAt: Date; approve?: boolean },
  ): Promise<PresenceJustifiee | null>;
}
