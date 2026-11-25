export interface OnboardingDossierForJobs {
  id: string;
  schoolId: string;
  nomProvisoire: string;
  contactEmail: string | null;
  contactTelephone: string | null;
  parentContactEmail: string | null;
  parentContactTelephone: string | null;
  token: string;
  tokenExpiresAt: Date;
  createdAt: Date;
  escalatedAt: Date | null;
  school: { name: string } | null;
}

export interface OnboardingSettingsForJobs {
  reminderDelayDays: number[];
  escalationDelayDays: number;
  responsableRole: string;
}

export interface EleveOnboardingJobsRepository {
  listerDossiersLinkSent(): Promise<OnboardingDossierForJobs[]>;
  trouverSettings(schoolId: string): Promise<OnboardingSettingsForJobs | null>;
  marquerExpire(id: string): Promise<void>;
  incrementerRelance(id: string): Promise<void>;
  trouverResponsables(schoolId: string, role: string): Promise<{ email: string | null; firstName: string }[]>;
  marquerEscalade(id: string): Promise<void>;
}
