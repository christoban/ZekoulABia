export interface AnonymatInvitationPort {
  envoyerInvitationAnonymat(params: {
    email: string;
    listUrl: string;
    schoolName: string;
    expiresAt: Date;
  }): Promise<void>;
} 