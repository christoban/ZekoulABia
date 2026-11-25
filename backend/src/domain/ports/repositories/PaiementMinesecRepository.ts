export type TypeFraisMinesec = 'SCOLARITE_PREMIER_CYCLE' | 'SCOLARITE_SECOND_CYCLE' | 'EXAMEN_BEPC' | 'EXAMEN_PROBATOIRE' | 'EXAMEN_BAC' | 'EXAMEN_GCE_OL' | 'EXAMEN_GCE_AL';

export interface InscriptionMinesecData {
  id: string;
  studentId: string;
  schoolId: string;
  anneeScolaire: string;
  classe: string;
  status: string;
  createdAt: Date;
}

export interface PaiementMinesecData {
  id: string;
  studentId: string;
  enrollmentId: string;
  schoolId: string;
  anneeScolaire: string;
  typeFrais: TypeFraisMinesec;
  montantAttendu: number;
  montantPaye: number | null;
  status: string;
  dateEcheance: Date | null;
  operateur: string | null;
  numeroRecu: string | null;
  recuVerifie: boolean;
  recuVerifieAt: Date | null;
  datePaiement: Date | null;
  dataSource: string;
  student?: { matricule: string | null } | null;
}

export interface TarifMinesecData {
  typeFrais: TypeFraisMinesec;
  montantFCFA: number;
}

export interface PaiementMinesecRepository {
  trouverProfileAvecClasse(profileId: string, schoolId: string): Promise<{ id: string; niveau: string | null } | null>;
  trouverEnrollment(studentId: string, schoolId: string, anneeScolaire: string): Promise<InscriptionMinesecData | null>;
  creerEnrollment(data: { studentId: string; schoolId: string; anneeScolaire: string; classe: string }): Promise<InscriptionMinesecData>;
  trouverPaiementExistant(enrollmentId: string, typeFrais: TypeFraisMinesec): Promise<{ id: string } | null>;
  trouverTarif(typeFrais: TypeFraisMinesec, anneeScolaire: string, niveauCategory: string): Promise<TarifMinesecData | null>;
  creerPaiement(data: { studentId: string; enrollmentId: string; schoolId: string; anneeScolaire: string; typeFrais: TypeFraisMinesec; montantAttendu: number }): Promise<{ id: string }>;
  trouverPaiement(paiementId: string): Promise<PaiementMinesecData | null>;
  mettreAJourPaiement(paiementId: string, data: Record<string, unknown>): Promise<void>;
  listerImpayes(studentId: string, anneeScolaire: string): Promise<PaiementMinesecData[]>;
  listerPaiementsEnrollment(enrollmentId: string): Promise<PaiementMinesecData[]>;
  listerPaiementsEtablissementEnrollment(enrollmentId: string): Promise<{ id: string; typeFrais: string; montantAttendu: number; montantPaye: number | null; status: string; recu: string | null }[]>;
  compterInscriptionsActives(schoolId: string, anneeScolaire: string): Promise<number>;
  agregerPaiementsMinesec(schoolId: string, anneeScolaire: string): Promise<{ status: string; _count: { _all: number }; _sum: { montantAttendu: number | null; montantPaye: number | null } }[]>;
  agregerPaiementsEtablissement(schoolId: string, anneeScolaire: string): Promise<{ status: string; _count: { _all: number }; _sum: { montantAttendu: number | null; montantPaye: number | null } }[]>;
  listerProfilsActifs(schoolId: string): Promise<{ id: string }[]>;
  trouverEcoleSubsystem(schoolId: string): Promise<{ subsystem: string } | null>;
  trouverProfileDashboard(studentUserId: string, schoolId: string): Promise<{
    id: string;
    nom: string;
    prenom: string;
    classe: string;
    matricule: string | null;
  } | null>;
  trouverEnrollmentActif(studentId: string, schoolId: string): Promise<InscriptionMinesecData | null>;
  listerPaiements(studentId: string, anneeScolaire: string): Promise<PaiementMinesecData[]>;
  listerImpayesMinesecSchool(schoolId: string, now: Date): Promise<{ id: string; studentId: string; studentName: string; typeFrais: string; montantAttendu: number; dateEcheance: Date | null }[]>;
  listerImpayesEtablissementSchool(schoolId: string): Promise<{ id: string; studentId: string; studentName: string; typeFrais: string; montantAttendu: number; montantPaye: number | null }[]>;
}