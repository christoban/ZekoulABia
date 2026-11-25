export interface DemandeTransfertData {
  id: string;
  groupId: string;
  type: 'STUDENT' | 'STAFF';
  sourceSchoolId: string;
  targetSchoolId: string;
  sourceUserId: string;
  requestedByOwnerId: string;
  status: string;
  decidedAt: Date | null;
  onboardingId: string | null;
  createdAt: Date;
}

export interface GroupTransferRepository {
  trouverParId(demandeId: string): Promise<DemandeTransfertData | null>;
  creer(data: {
    groupId: string;
    type: 'STUDENT' | 'STAFF';
    sourceSchoolId: string;
    targetSchoolId: string;
    sourceUserId: string;
    requestedByOwnerId: string;
  }): Promise<DemandeTransfertData>;
  listerEntrantesEnAttente(targetSchoolId: string): Promise<DemandeTransfertData[]>;
  listerParGroupe(groupId: string): Promise<DemandeTransfertData[]>;
  rejeter(demandeId: string): Promise<DemandeTransfertData>;
  /** Transaction atomique : statut ACCEPTED + onboardingId sur la demande ET studentStatus=TRANSFERRED sur le profil source. */
  accepterEleve(demandeId: string, onboardingId: string, studentProfileId: string): Promise<void>;
  accepterEnseignant(demandeId: string): Promise<void>;
}