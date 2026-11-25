/**
 * DOMAIN LAYER — Port Repository Invitation (SchoolInvite)
 */
import type { JsonValue } from '@domain/types/enums';
export interface InvitationProps {
  id: string;
  email: string;
  schoolName: string;
  token: string;
  schoolId?: string;
  invitedByMasterId?: string;
  plan: string;
  status: 'PENDING' | 'USED' | 'EXPIRED';
  expiresAt: Date;
  notes?: string;
  createdAt: Date;
}

export interface CompleteOnboardingCommand {
  token: string;
  school: {
    id: string;
    name: string;
    subdomain: string;
    address: string | null;
    city: string | null;
    region: string | null;
    phone: string | null;
    email: string | null;
    subsystem: string;
    educationType: string;
    ownership: string;
    admissionType?: string;
    plan: string;
    logoUrl: string | null;
    onboardingConfig?: JsonValue | null;
    templateCode: string | null;
  };
  admin: { email: string; firstName: string; lastName: string; passwordHash: string };
}

export interface InvitationRepository {
  findByToken(token: string): Promise<InvitationProps | null>;
  findBySchoolId(schoolId: string): Promise<InvitationProps[]>;
  findPendingByEmail(email: string): Promise<InvitationProps | null>;
  save(invitation: InvitationProps): Promise<void>;
  update(invitation: InvitationProps): Promise<void>;
  expireToutes(schoolId: string): Promise<void>;
  marquerUtilisee(token: string): Promise<void>;
  marquerExpiree(token: string): Promise<void>;
  /** Finalise l'inscription via invitation : met à jour l'école, crée l'admin et marque l'invitation USED — en une transaction atomique. */
  completeOnboarding(command: CompleteOnboardingCommand): Promise<{ schoolId: string }>;
}
