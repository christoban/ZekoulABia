export interface EcoleActive {
  id: string;
  name: string;
}

export interface AnneeCourante {
  id: string;
  startDate: Date;
  endDate: Date | null;
}

export interface PaiementOverdueForRelance {
  studentId: string;
  montantAttendu: number;
  typeFrais: string;
  student: {
    user: { id: string; firstName: string; lastName: string; phone: string | null };
  };
}

export interface MinesecJobsRepository {
  listerEcolesActives(): Promise<EcoleActive[]>;
  trouverAnneeCourante(schoolId: string): Promise<AnneeCourante | null>;
  listerPaiementsEnRetard(schoolId: string, anneeScolaire: string, seuilDate: Date): Promise<PaiementOverdueForRelance[]>;
  compterElevesActifs(schoolId: string): Promise<number>;
  compterSansMatricule(schoolId: string): Promise<number>;
}
