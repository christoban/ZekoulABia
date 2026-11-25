/**
 * DOMAIN LAYER — Port Repository Leave (congés prolongés)
 * Agrégat : LeaveRequest + LeaveBalance (approuver un congé décrémente le solde).
 */
export interface LeaveRequestData {
  id: string;
  userId: string;
  schoolId: string;
  type: string;
  dateDebut: Date;
  dateFin: Date;
  motif: string | null;
  statut: string;
  validatedBy: string | null;
  validatedAt: Date | null;
  createdAt: Date;
}

export interface LeaveBalanceData {
  id: string;
  userId: string;
  schoolId: string;
  annee: number;
  soldeInitial: number;
  soldeRestant: number;
  updatedAt: Date;
}

export interface LeaveRepository {
  findRequestByIdAndSchool(id: string, schoolId: string): Promise<LeaveRequestData | null>;
  updateRequestStatus(id: string, statut: string, validatedById: string | null): Promise<LeaveRequestData>;
  createRequest(data: { userId: string; schoolId: string; type: string; dateDebut: Date; dateFin: Date; motif?: string }): Promise<LeaveRequestData>;
  findRequestsBySchool(schoolId: string, userId?: string): Promise<LeaveRequestData[]>;
  findBalanceForYear(userId: string, annee: number): Promise<LeaveBalanceData | null>;
  findLatestBalance(userId: string, schoolId: string): Promise<LeaveBalanceData | null>;
  createBalance(data: { userId: string; schoolId: string; annee: number }): Promise<LeaveBalanceData>;
  upsertBalanceForYear(userId: string, schoolId: string, annee: number): Promise<LeaveBalanceData>;
  decrementBalance(id: string, jours: number): Promise<void>;
  findBalancesByUser(userId: string, schoolId: string): Promise<LeaveBalanceData[]>;
}
