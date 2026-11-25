export interface PrepareExamDossierCommande {
  schoolId: string;
  studentUserId: string;
  typeExamen: string;
  anneeScolaire: string;
}

export interface ExamDossier {
  registrationId: string;
  student: { nom: string; prenom: string; matricule: string | null; classe: string };
  typeExamen: string;
  anneeScolaire: string;
  session: number;
  status: string;
  matriculeVerifie: boolean;
  paiementMinesecStatus: string | null;
  message: string;
}
