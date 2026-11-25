export type PebsExamStatus = 'DRAFT' | 'RESULTS_PENDING' | 'APPLIED';
export type PebsSelectionResult = 'PENDING' | 'SELECTIONNE' | 'NON_SELECTIONNE';

export interface PebsSessionData {
  id: string;
  schoolId: string;
  name: string;
  examDate: Date;
  level: string;
  academicYearId: string;
  selectionThreshold: number | null;
  availableSeats: number | null;
  targetClassId: string;
  status: PebsExamStatus;
}

export interface PebsCandidateData {
  id: string;
  sessionId: string;
  studentProfileId: string;
  currentClassId: string | null;
  examScore: number | null;
  selectionResult: PebsSelectionResult;
  studentProfile?: {
    user?: { id: string; firstName: string; lastName: string } | null;
    enrollmentsYearScoped?: { class?: { name?: string | null } | null }[] | null;
  } | null;
}

export interface PebsExamRepository {
  listerSessions(schoolId: string): Promise<PebsSessionData[]>;
  trouverSession(sessionId: string): Promise<PebsSessionData | null>;
  creerSession(data: {
    schoolId: string;
    name: string;
    examDate: Date;
    level: string;
    academicYearId: string;
    selectionThreshold?: number | null;
    availableSeats?: number | null;
    targetClassId: string;
  }): Promise<PebsSessionData>;
  mettreAJourStatutSession(sessionId: string, status: PebsExamStatus): Promise<void>;
  trouverCandidatParProfil(sessionId: string, studentProfileId: string): Promise<{ id: string } | null>;
  trouverProfilAvecClasse(profileId: string, schoolId: string): Promise<{ id: string; classId: string | null } | null>;
  creerCandidat(data: {
    sessionId: string;
    studentProfileId: string;
    currentClassId: string | null;
  }): Promise<{ id: string }>;
  listerCandidatsAvecProfil(sessionId: string, selectionResults?: PebsSelectionResult[]): Promise<PebsCandidateData[]>;
  listerCandidatsAvecNote(sessionId: string): Promise<PebsCandidateData[]>;
  mettreAJourScoreCandidat(candidateId: string, examScore: number): Promise<void>;
  mettreAJourResultatCandidat(candidateId: string, selectionResult: PebsSelectionResult): Promise<void>;
  trouverClasseCible(classId: string): Promise<{ schoolId: string; academicYearId: string } | null>;
  trouverAdminEcole(schoolId: string): Promise<{ id: string } | null>;
  trouverEcoleSubsystem(schoolId: string): Promise<{ subsystem: string } | null>;
}