export interface ApeeTransactionData {
  id: string;
  schoolId: string;
  creeParId: string;
  type: string;
  montant: number;
  categorie: string | null;
  description: string | null;
  date: Date;
  valide: boolean;
  valideParId: string | null;
  valideAt: Date | null;
  justificatifUrl: string | null;
  createdAt: Date;
}

export interface ApeeTransactionAvecAuteurs extends ApeeTransactionData {
  creePar?: { firstName: string; lastName: string } | null;
  validePar?: { firstName: string; lastName: string } | null;
}

export interface ApeeSolde {
  totalCollectes: number;
  totalDepenses: number;
  depensesEnAttente: number;
}

export interface ApeeRepository {
  creer(data: {
    schoolId: string;
    creeParId: string;
    type: string;
    montant: number;
    categorie?: string;
    description?: string;
    date: Date;
    valide: boolean;
  }): Promise<ApeeTransactionData>;

  trouverParId(id: string, schoolId: string): Promise<ApeeTransactionData | null>;

  valider(id: string, valideParId: string): Promise<ApeeTransactionData>;

  listerTransactions(schoolId: string, includeAuteurs: boolean): Promise<ApeeTransactionAvecAuteurs[]>;
  attacherJustificatif(id: string, justificatifUrl: string): Promise<ApeeTransactionData>;
  obtenirSolde(schoolId: string): Promise<ApeeSolde>;
}
