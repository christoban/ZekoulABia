export interface CreerSessionConcoursCommande {
  schoolId: string;
  name: string;
  examDate: Date;
  academicYearId: string;
  admissionThreshold?: number;
  availableSeats?: number;
}

export interface AjouterCandidatsCommande {
  schoolId: string;
  sessionId: string;
  candidats: { firstName: string; lastName: string; dateOfBirth?: Date; originSchool?: string; examScore?: number; parentPhone?: string }[];
}

export interface CalculerAdmissionCommande {
  schoolId: string;
  sessionId: string;
}

export interface EnregistrerResultatCepCommande {
  schoolId: string;
  candidateId: string;
  cepResult: 'REUSSI' | 'ECHOUE';
  /** Utilisateur (staff) qui enregistre le résultat — traçabilité du squelette d'onboarding créé en cas de REUSSI. */
  enregistreParId: string;
}

export interface CreerCompteDepuisCandidatCommande {
  schoolId: string;
  candidateId: string;
  classeId: string;
}

export interface CandidatResult {
  id: string;
  firstName: string;
  lastName: string;
  examScore: number | null;
  admissionStatus: string;
  cepResult: string | null;
  cepResultDate: Date | null;
  studentProfileId: string | null;
}

export interface SessionSummary {
  session: { id: string; name: string; status: string; examDate: Date; admissionThreshold: number | null; availableSeats: number | null };
  total: number;
  pending: number;
  admisProvisoire: number;
  confirms: number;
  annules: number;
  cepPending: number;
  candidates: CandidatResult[];
}
