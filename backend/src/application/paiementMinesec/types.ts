export interface GenererPaiementsCommande {
  schoolId: string;
  studentProfileId: string;
  anneeScolaire: string;
}

export interface GenererPaiementsEcoleCommande {
  schoolId: string;
  anneeScolaire: string;
}

export interface GenererPaiementsEcoleResultat {
  elevesTraites: number;
  enrollmentsCrees: number;
  paiementsGeneres: number;
  paiementsIgnores: number;
  erreurs: string[];
}

export interface PaiementMinesecItem {
  id: string;
  typeFrais: string;
  montantAttendu: number;
  montantPaye: number | null;
  status: string;
  dateEcheance: Date | null;
  operateur: string | null;
  recuVerifie: boolean;
}

export interface StudentPaymentDashboard {
  student: {
    id: string;
    nom: string;
    prenom: string;
    classe: string;
    matriculeNational: string | null;
  };
  enrollment: {
    id: string;
    status: string;
    anneeScolaire: string;
  };
  paiementsMinesec: PaiementMinesecItem[];
  paiementsEtablissement: {
    id: string;
    label: string;
    montantAttendu: number;
    montantPaye: number;
    status: string;
    recu: string | null;
  }[];
  totaux: {
    totalAttendu: number;
    totalPaye: number;
    totalRestant: number;
    statutGlobal: 'A_JOUR' | 'PARTIELLEMENT_PAYE' | 'EN_RETARD';
  };
}
