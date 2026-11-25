import type { OnboardingRecipient, OnboardingSource, OnboardingStatus } from '@domain/types/enums';

export type { OnboardingRecipient, OnboardingSource, OnboardingStatus };

export type DispositifOS = 'ANDROID' | 'IOS' | 'AUTRE';

export interface CreerSqueletteOnboardingCommande {
  schoolId: string;
  createdById: string;
  nomProvisoire: string;
  classId?: string | null;
  contactEmail?: string | null;
  contactTelephone?: string | null;
  parentContactEmail?: string | null;
  parentContactTelephone?: string | null;
  recipientType?: OnboardingRecipient;
  sourceType?: OnboardingSource;
  examCandidateId?: string | null;
  /** Capacité numérique déclarée au moment du remplissage (staff face-à-face ou famille elle-même). */
  eleveADispositif?: boolean | null;
  eleveDispositifOS?: DispositifOS | null;
  parentADispositif?: boolean | null;
  parentDispositifOS?: DispositifOS | null;
  /**
   * Confirme explicitement que la famille n'a absolument aucun moyen de contact (ni email, ni
   * téléphone, élève et parent). Seul ce flag permet de créer le dossier sans email/téléphone —
   * jamais un simple oubli des deux champs (Principe 1 : le dossier doit toujours exister).
   */
  aucunContactDisponible?: boolean;
}

export interface CreerSqueletteOnboardingResultat {
  id: string;
  token: string;
  tokenExpiresAt: Date;
  status: string;
  recipientType: string;
  contactEmail: string | null;
  contactTelephone: string | null;
}

export interface SoumettreFormulaireOnboardingCommande {
  token: string;
  nom: string;
  prenom: string;
  /** DD/MM/AAAA ou ISO — parsé via parseDateFR. Sans elle, le matching ne peut pas s'exécuter (verrou dur). */
  dateNaissance?: string;
  /** Reste du formulaire (genre, école d'origine...), stocké tel quel dans submittedData. */
  donneesComplementaires?: Record<string, unknown>;
  /**
   * Capacité numérique déclarée par la famille elle-même — seul point de capture possible
   * pour un dossier CONCOURS (créé sans contact humain, voir EnregistrerResultatCepUseCase).
   * N'écrase la valeur existante que si explicitement fournie.
   */
  eleveADispositif?: boolean;
  parentADispositif?: boolean;
}

export interface SoumettreFormulaireOnboardingResultat {
  id: string;
  status: string;
  matchScore: number | null;
  matchedStudentId: string | null;
}

export interface ValiderOnboardingCommande {
  schoolId: string;
  onboardingId: string;
  validatedById: string;
  /** Rôle de l'utilisateur qui valide — vérifié contre SchoolOnboardingSettings.responsableRole. */
  validatorRole: string;
  /** Override de la suggestion de classe, si le responsable la change au moment de valider. */
  classId?: string | null;
}

/** Un compte (élève et/ou parent) créé ou réutilisé pendant la validation, à notifier par le contrôleur. */
export interface ValiderOnboardingCompteResultat {
  role: 'STUDENT' | 'PARENT';
  userId: string;
  /**
   * Token EN CLAIR pour le lien "configurez votre mot de passe" — null si compte existant
   * réutilisé (rien à configurer), OU si accessMode=SMS_ONLY (aucun lien n'est jamais généré).
   */
  temporaryPassword: string | null;
  dispositifOS: string | null;
  contactEmail: string | null;
  contactTelephone: string | null;
  /** true si un compte PARENT existant a été réutilisé (autre enfant déjà scolarisé) plutôt que recréé. */
  compteExistant: boolean;
  /** FULL_ACCESS par défaut ; SMS_ONLY si ce destinataire n'a déclaré aucun dispositif capable d'ouvrir un lien. */
  accessMode: 'FULL_ACCESS' | 'SMS_ONLY';
}

export interface ValiderOnboardingResultat {
  onboardingId: string;
  studentProfileId: string;
  recipientType: string;
  /** 1 compte (STUDENT) si recipientType=ELEVE, 1 (PARENT) si PARENT, 2 si LES_DEUX. */
  comptesCrees: ValiderOnboardingCompteResultat[];
}

export interface RejeterOnboardingCommande {
  schoolId: string;
  onboardingId: string;
  rejectedById: string;
  validatorRole: string;
  rejectionReason: string;
}

export interface RejeterOnboardingResultat {
  onboardingId: string;
  status: string;
}
