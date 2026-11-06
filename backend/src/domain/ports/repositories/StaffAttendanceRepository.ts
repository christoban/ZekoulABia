/**
 * DOMAIN LAYER — Port Repository StaffAttendance (présence du personnel enseignant)
 *
 * Pointage V2.11 : QR par salle (token signé horodaté) ou GPS ponctuel, croisé avec le
 * TimetableSlot courant. Scope restreint aux enseignants (role: TEACHER).
 */

export type StaffAttendanceStatut = 'PRESENT' | 'ABSENT' | 'RETARD' | 'A_VERIFIER';
export type StaffAttendanceMode = 'QR' | 'GPS' | 'MANUEL';

export interface StaffAttendanceData {
  id: string;
  userId: string;
  schoolId: string;
  date: Date;
  statut: StaffAttendanceStatut;
  note: string | null;
  mode: StaffAttendanceMode | null;
  roomId: string | null;
  timetableSlotId: string | null;
  qrToken: string | null;
  latitude: number | null;
  longitude: number | null;
  verifiedById: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
}

export interface CreerStaffAttendanceInput {
  userId: string;
  schoolId: string;
  date: Date;
  statut: StaffAttendanceStatut;
  note?: string | null;
  mode?: StaffAttendanceMode;
  roomId?: string | null;
  timetableSlotId?: string | null;
  qrToken?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

export interface StaffAttendanceRoomConfig {
  id: string;
  name: string;
  qrEnabled: boolean;
}

export interface StaffAttendanceSlotCourant {
  id: string;
  subjectName: string | null;
  className: string | null;
  roomId: string | null;
  roomName: string | null;
  qrEnabled: boolean;
}

export interface MiseAJourStaffAttendanceSettings {
  gpsRadiusMeters?: number;
  qrTokenTtlSeconds?: number;
  schoolLatitude?: number | null;
  schoolLongitude?: number | null;
  roomsQrConfig?: { roomId: string; qrEnabled: boolean }[];
}

export interface StaffAttendanceSettingsData {
  schoolId: string;
  gpsRadiusMeters: number;
  qrTokenTtlSeconds: number;
  schoolLatitude: number | null;
  schoolLongitude: number | null;
}

export interface StaffAttendanceRepository {
  upsert(data: { userId: string; schoolId: string; date: Date; statut: string; note?: string }): Promise<StaffAttendanceData>;

  /** Pointage enseignant : upsert quotidien avec mode + infos de géolocalisation/QR. */
  pointer(data: CreerStaffAttendanceInput): Promise<StaffAttendanceData>;

  findBySchool(schoolId: string, filters?: { userId?: string; debut?: Date; fin?: Date; statut?: StaffAttendanceStatut }): Promise<StaffAttendanceData[]>;

  /** Trouve la présence pointée d'un enseignant pour un créneau donné (gate cahier de textes). */
  trouverPresencePourCreneau(
    userId: string,
    schoolId: string,
    date: Date,
    timetableSlotId: string,
  ): Promise<StaffAttendanceData | null>;

  /** Requalifie un pointage A_VERIFIER → PRESENT (validation RH). */
  requalifier(id: string, schoolId: string, statut: StaffAttendanceStatut, verifiedById: string): Promise<StaffAttendanceData>;

  /** Paramètres de pointage d'une école (rayon GPS, TTL token QR), défauts si absents. */
  getSettings(schoolId: string): Promise<StaffAttendanceSettingsData>;

  /** QrEnabled d'une salle. */
  salleQrEnabled(roomId: string, schoolId: string): Promise<boolean>;

  /** Salles de l'école avec leur configuration QR. */
  listerSalles(schoolId: string): Promise<StaffAttendanceRoomConfig[]>;

  /** Créneau de cours en cours pour un enseignant à un instant donné. */
  trouverCreneauCourant(teacherId: string, schoolId: string, maintenant: Date): Promise<StaffAttendanceSlotCourant | null>;

  /** Met à jour les réglages GPS/QR de l'école et la configuration QR des salles. */
  mettreAJourSettings(schoolId: string, data: MiseAJourStaffAttendanceSettings): Promise<void>;
}