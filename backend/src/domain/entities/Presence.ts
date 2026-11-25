/**
 * DOMAIN LAYER — Entité Presence (Attendance)
 * Enregistre la présence d'un élève à un cours ou une période.
 * Supporte le mode hors ligne avec marquage isOfflineSync.
 */
import type { AttendanceStatus, AttendancePeriod, JustificationStatus } from '@domain/types/enums';

export interface PresenceProps {
  id: string;
  schoolId: string;
  studentId: string;
  classId: string;
  academicPeriodId?: string;
  subjectId?: string;
  teacherId?: string;
  recordedById?: string;
  date: Date;
  status: AttendanceStatus;
  period: AttendancePeriod;
  arrivedAt?: Date;
  lateNote?: string;
  justification?: string;
  justificationStatus?: JustificationStatus;
  justificationAttachmentUrl?: string;
  submittedByParentId?: string;
  justifiedById?: string;
  justifiedAt?: Date;
  previousStatus?: AttendanceStatus;
  updatedById?: string;
  updatedAt?: Date;
  isOfflineSync: boolean;
  syncedAt?: Date;
  clientRecordedAt?: Date;
  clockSkewSeconds?: number;
  createdAt: Date;
}

export interface EnregistrerPresenceProps {
  schoolId: string;
  studentId: string;
  classId: string;
  date: Date;
  status: AttendanceStatus;
  period: AttendancePeriod;
  recordedById: string;
  academicPeriodId?: string;
  subjectId?: string;
  teacherId?: string;
  arrivedAt?: Date;
  lateNote?: string;
  isOfflineSync?: boolean;
  clientRecordedAt?: Date;
}

export class Presence {
  private constructor(private readonly props: PresenceProps) {}

  // --- Factories ---

  static create(props: EnregistrerPresenceProps): Presence {
    if (!props.studentId) throw new Error('L\'identifiant de l\'élève est obligatoire');
    if (!props.classId) throw new Error('L\'identifiant de la classe est obligatoire');
    if (!props.date) throw new Error('La date est obligatoire');

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const datePresence = new Date(props.date);
    datePresence.setHours(0, 0, 0, 0);

    // On ne peut pas enregistrer une présence dans le futur
    if (datePresence > today) {
      throw new Error('Impossible d\'enregistrer une présence pour une date future');
    }

    const now = new Date();
    const clockSkewSeconds = props.clientRecordedAt
      ? Math.round((now.getTime() - props.clientRecordedAt.getTime()) / 1000)
      : undefined;

    // Si une heure d'arrivée est fournie sur un élève non absent, le statut canonique est PRESENT
    const normalizedStatus: AttendanceStatus = props.arrivedAt && props.status === 'LATE'
      ? 'PRESENT'
      : props.status;

    return new Presence({
      ...props,
      id: crypto.randomUUID(),
      status: normalizedStatus,
      isOfflineSync: props.isOfflineSync ?? false,
      syncedAt: props.isOfflineSync ? now : undefined,
      clockSkewSeconds,
      createdAt: now,
    });
  }

  static reconstituer(props: PresenceProps): Presence {
    return new Presence(props);
  }

  // --- Getters ---

  get id(): string { return this.props.id; }
  get schoolId(): string { return this.props.schoolId; }
  get studentId(): string { return this.props.studentId; }
  get classId(): string { return this.props.classId; }
  get date(): Date { return this.props.date; }
  get status(): AttendanceStatus { return this.props.status; }
  get period(): AttendancePeriod { return this.props.period; }
  get teacherId(): string | undefined { return this.props.teacherId; }
  get subjectId(): string | undefined { return this.props.subjectId; }
  get arrivedAt(): Date | undefined { return this.props.arrivedAt; }
  get lateNote(): string | undefined { return this.props.lateNote; }
  get clockSkewSeconds(): number | undefined { return this.props.clockSkewSeconds; }
  get isOfflineSync(): boolean { return this.props.isOfflineSync; }

  // --- Méthodes métier ---

  estPresent(): boolean { return this.props.status === 'PRESENT'; }
  estAbsent(): boolean { return this.props.status === 'ABSENT'; }
  estEnRetard(): boolean { return this.props.status === 'LATE' || Boolean(this.props.arrivedAt); }

  estAbsenceOuRetard(): boolean {
    return this.props.status === 'ABSENT' || this.estEnRetard();
  }

  // Appelée lors de la synchronisation hors ligne réussie
  marquerSynchronise(): void {
    if (!this.props.isOfflineSync) {
      throw new Error('Cette présence n\'est pas marquée comme hors ligne');
    }
    this.props.isOfflineSync = false;
    this.props.syncedAt = new Date();
  }

  // --- Sérialisation ---

  toObject(): PresenceProps {
    return { ...this.props };
  }
}
