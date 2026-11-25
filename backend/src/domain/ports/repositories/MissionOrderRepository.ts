/**
 * DOMAIN LAYER — Port Repository MissionOrder (ordre de mission)
 */
export interface MissionOrderData {
  id: string;
  userId: string;
  schoolId: string;
  motif: string;
  lieu: string;
  dateDebut: Date;
  dateFin: Date;
  signataire: string | null;
  createdAt: Date;
}

export interface MissionOrderRepository {
  create(data: { userId: string; schoolId: string; motif: string; lieu: string; dateDebut: Date; dateFin: Date; signataire?: string }): Promise<MissionOrderData>;
  findByIdAndSchool(id: string, schoolId: string): Promise<MissionOrderData | null>;
}
