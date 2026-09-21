export type EntranceExamStatus =
  | 'DRAFT'
  | 'REGISTRATION_OPEN'
  | 'SEATS_ASSIGNED'
  | 'IN_PROGRESS'
  | 'GRADING'
  | 'DELIBERATION'
  | 'PUBLISHED'
  | 'CLOSED'
  | 'RESULTS_PENDING';

export type EntranceAdmissionStatus =
  | 'PENDING'
  | 'ADMIS_PROVISOIRE'
  | 'ADMIS'
  | 'LISTE_ATTENTE'
  | 'REFUSE'
  | 'REPECHE'
  | 'CONFIRME'
  | 'INSCRIT'
  | 'FORFAIT'
  | 'ANNULE';

export type EntranceCepResult = 'NON_PASSE' | 'REUSSI' | 'ECHOUE';
export type CandidatePresence = 'PRESENT' | 'ABSENT' | 'ABANDON';

export interface EntranceSubjectData {
  id: string;
  sessionId: string;
  name: string;
  coefficient: number;
  maxScore: number;
  eliminatoryScore: number | null;
  orderIndex: number;
}

export interface EntranceRoomData {
  id: string;
  sessionId: string;
  name: string;
  capacity: number;
  assignedCandidatesCount?: number;
}

export interface EntranceCandidateGradeData {
  id: string;
  candidateId: string;
  subjectId: string;
  score: number | null;
  isAbsent: boolean;
  subject?: EntranceSubjectData;
}

export interface EntranceSessionData {
  id: string;
  schoolId: string;
  name: string;
  examDate: Date;
  academicYearId: string;
  admissionThreshold: number | null;
  availableSeats: number | null;
  status: EntranceExamStatus;
  targetClassId: string | null;
  registrationDeadline?: Date | null;
  requireCepForAdmission?: boolean;
  seatReservationDays?: number;
  deliberatedAt?: Date | null;
  publishedAt?: Date | null;
  subjects?: EntranceSubjectData[];
  rooms?: EntranceRoomData[];
}

export interface EntranceCandidateData {
  id: string;
  sessionId: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | null;
  originSchool: string | null;
  examScore: number | null;
  parentPhone: string | null;
  admissionStatus: EntranceAdmissionStatus;
  cepResult: EntranceCepResult | null;
  cepResultDate: Date | null;
  studentProfileId: string | null;
  candidateNumber?: string | null;
  totalAverage?: number | null;
  rank?: number | null;
  presenceStatus?: CandidatePresence;
  roomId?: string | null;
  deskNumber?: number | null;
  reservationExpiresAt?: Date | null;
  room?: EntranceRoomData | null;
  grades?: EntranceCandidateGradeData[];
  session?: EntranceSessionData | null;
}

export interface CreerSessionConcoursInput {
  schoolId: string;
  name: string;
  examDate: Date;
  academicYearId: string;
  admissionThreshold?: number | null;
  availableSeats?: number | null;
  registrationDeadline?: Date | null;
  requireCepForAdmission?: boolean;
  seatReservationDays?: number;
  targetClassId?: string | null;
}

export interface EntranceExamRepository {
  listerSessions(schoolId: string): Promise<EntranceSessionData[]>;
  trouverSession(sessionId: string): Promise<EntranceSessionData | null>;
  trouverSessionAvecDetails?(sessionId: string): Promise<EntranceSessionData | null>;
  creerSession(data: CreerSessionConcoursInput): Promise<EntranceSessionData>;
  mettreAJourStatutSession(
    sessionId: string,
    status: EntranceExamStatus,
    extra?: { deliberatedAt?: Date; publishedAt?: Date }
  ): Promise<void>;
  compterCandidatsEnAttente(sessionId: string): Promise<number>;
  compterCandidatsSession?(sessionId: string): Promise<number>;

  // Gestion des épreuves / matières
  listerMatieres?(sessionId: string): Promise<EntranceSubjectData[]>;
  configurerMatieres?(
    sessionId: string,
    matieres: { name: string; coefficient: number; maxScore?: number; eliminatoryScore?: number | null }[]
  ): Promise<EntranceSubjectData[]>;

  // Gestion des salles
  listerSalles?(sessionId: string): Promise<EntranceRoomData[]>;
  creerSalle?(sessionId: string, name: string, capacity: number): Promise<EntranceRoomData>;
  supprimerSalle?(roomId: string): Promise<void>;
  assignerSallePlace?(candidateId: string, roomId: string | null, deskNumber: number | null): Promise<void>;

  // Gestion des candidats
  creerCandidat(data: {
    sessionId: string;
    candidateNumber?: string | null;
    firstName: string;
    lastName: string;
    dateOfBirth?: Date | null;
    originSchool?: string | null;
    examScore?: number | null;
    parentPhone?: string | null;
  }): Promise<{ id: string; candidateNumber: string | null }>;
  trouverDernierNumeroSequence?(sessionId: string): Promise<number>;
  listerCandidats(
    sessionId: string,
    options?: { avecNote?: boolean; orderBy?: 'score' | 'nom' | 'rang' | 'code'; roomId?: string }
  ): Promise<EntranceCandidateData[]>;
  trouverCandidatAvecSession(candidateId: string): Promise<EntranceCandidateData | null>;
  trouverCandidatParCodeEtDateNaissance?(
    sessionId: string,
    candidateNumber: string,
    dateOfBirth: Date
  ): Promise<EntranceCandidateData | null>;
  enregistrerPresenceCandidat?(candidateId: string, presenceStatus: CandidatePresence): Promise<void>;

  // Saisie et calcul des notes
  sauvegarderNotesCandidat?(
    candidateId: string,
    notes: { subjectId: string; score?: number | null; isAbsent?: boolean }[]
  ): Promise<void>;
  mettreAJourScoreEtRangCandidat?(
    candidateId: string,
    totalAverage: number | null,
    rank: number | null,
    admissionStatus?: EntranceAdmissionStatus
  ): Promise<void>;

  // Admissions & délibération
  appliquerDeliberation?(
    sessionId: string,
    admissions: { candidateId: string; status: EntranceAdmissionStatus; reservationExpiresAt?: Date | null }[]
  ): Promise<void>;
  mettreAJourResultatCEP(
    candidateId: string,
    data: { cepResult: EntranceCepResult; admissionStatus: EntranceAdmissionStatus }
  ): Promise<void>;
  mettreAJourStatutAdmission(candidateId: string, admissionStatus: EntranceAdmissionStatus): Promise<void>;
  trouverClasseNiveau(schoolId: string, niveau: string): Promise<{ id: string } | null>;
}