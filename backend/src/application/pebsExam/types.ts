export interface CreerSessionPebsCommande {
  schoolId: string;
  name: string;
  examDate: Date;
  level: string;
  academicYearId: string;
  selectionThreshold?: number;
  availableSeats?: number;
  targetClassId: string;
}

export interface AjouterCandidatsPebsCommande {
  schoolId: string;
  sessionId: string;
  studentProfileIds: string[];
}

export interface CalculerSelectionPebsCommande {
  schoolId: string;
  sessionId: string;
}

export interface AppliquerTransfertPebsCommande {
  schoolId: string;
  sessionId: string;
  confirmed: boolean;
}

export interface CandidatPebsResult {
  id: string;
  studentProfileId: string;
  firstName: string;
  lastName: string;
  currentClassName: string;
  examScore: number | null;
  selectionResult: string;
}

export interface SessionPebsSummary {
  session: { id: string; name: string; level: string; status: string; examDate: Date; targetClassId: string; selectionThreshold: number | null; availableSeats: number | null };
  total: number;
  pending: number;
  selectionnes: number;
  nonSelectionnes: number;
  candidates: CandidatPebsResult[];
}
