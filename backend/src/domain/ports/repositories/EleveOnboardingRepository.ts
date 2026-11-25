/**
 * DOMAIN LAYER — Port Repository Onboarding Élève
 * Persistance du flux d'onboarding auto-service (squelette → soumission → validation/rejet).
 */
import type { OnboardingRecipient, OnboardingSource, OnboardingStatus } from '@domain/types/enums';

export interface OnboardingSettings {
  selfServiceEnabled: boolean;
  defaultRecipient: OnboardingRecipient;
  ageThresholdForParent: number;
  tokenExpiryDays: number;
  reminderDelayDays?: number[];
  escalationDelayDays?: number;
  responsableRole: string;
  directAdmissionWithoutExam?: boolean;
  capacityBufferPercent?: number;
}

export interface OnboardingRecord {
  id: string;
  schoolId: string;
  nomProvisoire: string;
  classId: string | null;
  contactEmail: string | null;
  contactTelephone: string | null;
  parentContactEmail: string | null;
  parentContactTelephone: string | null;
  recipientType: OnboardingRecipient;
  eleveADispositif: boolean | null;
  eleveDispositifOS: string | null;
  parentADispositif: boolean | null;
  parentDispositifOS: string | null;
  sourceType: OnboardingSource;
  examCandidateId: string | null;
  token: string;
  tokenExpiresAt: Date;
  tokenUsedAt: Date | null;
  submittedData: unknown;
  matchScore: number | null;
  matchedStudentId: string | null;
  status: OnboardingStatus;
  completenessScore?: number | null;
  validableSousReserve?: boolean;
  numeroInterne?: string | null;
  returnedComment?: string | null;
  submittedById?: string | null;
  createdStudentId?: string | null;
}

export interface OnboardingProfileMatch {
  id: string;
  lastName: string;
  firstName: string;
}

export interface ValiderOnboardingCompteResultat {
  role: 'STUDENT' | 'PARENT';
  userId: string;
  temporaryPassword: string | null;
  dispositifOS: string | null;
  contactEmail: string | null;
  contactTelephone: string | null;
  compteExistant: boolean;
  accessMode: 'FULL_ACCESS' | 'SMS_ONLY';
}

export interface ValiderOnboardingInput {
  schoolId: string;
  onboardingId: string;
  validatedById: string;
  classId: string;
  nom: string;
  prenom: string;
  dateOfBirth: Date | null;
  gender: string | null;
  eleveContactEmail: string | null;
  eleveContactTelephone: string | null;
  parentContactEmail: string | null;
  parentContactTelephone: string | null;
  parentRecoitContact: boolean;
  eleveAccessMode: 'FULL_ACCESS' | 'SMS_ONLY';
  parentAccessMode: 'FULL_ACCESS' | 'SMS_ONLY';
  eleveDispositifOS?: string | null;
  parentDispositifOS?: string | null;
  examCandidateId?: string | null;
  derogationCapacite?: boolean;
  motifDerogation?: string;
  roleActeur?: string;
}

export interface DocumentRequirementRecord {
  id: string;
  schoolId: string;
  code: string;
  libelle: string;
  obligatoire: boolean;
  applicableCase: string; // 'TOUS' | 'NOUVEAU' | 'TRANSFERT' | 'REDOUBLANT'
}

export interface DocumentRecord {
  id: string;
  onboardingId: string;
  requirementId: string | null;
  code: string;
  libelle: string;
  received: boolean;
  receivedAt: Date | null;
  receivedById: string | null;
  note: string | null;
  fileKey: string | null;
}

export interface EleveOnboardingRepository {
  // Lectures
  findSettings(schoolId: string): Promise<OnboardingSettings | null>;
  upsertSettings(schoolId: string, data: Partial<OnboardingSettings>): Promise<OnboardingSettings>;
  findOnboardingById(id: string, schoolId: string): Promise<OnboardingRecord | null>;
  findOnboardingByToken(token: string): Promise<OnboardingRecord | null>;
  findOnboardingByTokenWithClasse(token: string): Promise<(OnboardingRecord & { classe?: { name: string; level: string } | null }) | null>;
  listOnboardings(schoolId: string, status?: string): Promise<OnboardingRecord[]>;
  findOnboardingForPdf(id: string, schoolId: string): Promise<(OnboardingRecord & { classe?: { name: string } | null; school?: { name: string } | null }) | null>;
  findClassOnboardingInfo(classId: string): Promise<{ level: string; templateCode: string | null } | null>;
  findProfilesParDateNaissance(schoolId: string, dateOfBirth: Date): Promise<OnboardingProfileMatch[]>;
  findGroupTransferRequestByOnboarding(onboardingId: string): Promise<{ sourceUserId: string } | null>;

  // Écritures simples
  createSquelette(data: {
    schoolId: string;
    nomProvisoire: string;
    classId: string | null;
    contactEmail: string | null;
    contactTelephone: string | null;
    parentContactEmail: string | null;
    parentContactTelephone: string | null;
    recipientType: OnboardingRecipient;
    sourceType: OnboardingSource;
    examCandidateId: string | null;
    eleveADispositif: boolean | null;
    eleveDispositifOS: string | null;
    parentADispositif: boolean | null;
    parentDispositifOS: string | null;
    token: string;
    tokenExpiresAt: Date;
  }): Promise<OnboardingRecord>;
  marquerOnboardingExpire(id: string): Promise<void>;
  soumettreFormulaire(id: string, data: {
    submittedData: Record<string, unknown>;
    submittedAt: Date;
    tokenUsedAt: Date;
    matchScore: number | null;
    matchedStudentId: string | null;
    eleveADispositif?: boolean;
    parentADispositif?: boolean;
  }): Promise<void>;
  rejeterOnboarding(id: string, data: { rejectionReason: string; rejectedById: string; rejectedAt: Date }): Promise<void>;
  reactiverStudentProfilesTransferes(sourceUserId: string): Promise<void>;
  soumettreOnboarding(id: string, data: {
    submittedData?: Record<string, unknown>;
    classId?: string;
    nomProvisoire?: string;
    submittedById: string;
    submitterRole: string;
  }): Promise<void>;
  renvoyerOnboarding(id: string, data: {
    commentaire: string;
    adminId: string;
  }): Promise<void>;

  // Écriture atomique — ValiderOnboarding (tx multi-tables unique)
  validerOnboarding(input: ValiderOnboardingInput): Promise<{ studentProfileId: string; comptesCrees: ValiderOnboardingCompteResultat[] }>;

  // ── Pièces justificatives ────────────────────────────────────────────────
  // Exigences (configuration par établissement)
  listDocumentRequirements(schoolId: string): Promise<DocumentRequirementRecord[]>;
  upsertDocumentRequirement(schoolId: string, data: {
    code: string;
    libelle: string;
    obligatoire?: boolean;
    applicableCase?: string;
  }): Promise<DocumentRequirementRecord>;
  deleteDocumentRequirement(schoolId: string, code: string): Promise<void>;

  // Documents par dossier
  listDocuments(onboardingId: string): Promise<DocumentRecord[]>;
  initialiserDocuments(onboardingId: string, requirements: DocumentRequirementRecord[]): Promise<DocumentRecord[]>;
  marquerDocumentRecu(onboardingId: string, code: string, data: {
    received: boolean;
    receivedById: string;
    note?: string | null;
    fileKey?: string | null;
  }): Promise<DocumentRecord>;
  updateCompletenessScore(onboardingId: string, score: number, validableSousReserve: boolean): Promise<void>;
}

