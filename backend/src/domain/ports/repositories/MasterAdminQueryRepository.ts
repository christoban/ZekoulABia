/**
 * DOMAIN LAYER — Port Repository MasterAdmin (lecture seule)
 * Expose les requêtes de lecture du master admin. Les écritures/transactions restent
 * dans des Use Cases dédiés (jamais de prisma dans les controllers HTTP).
 */
export interface EcoleDetail {
  id: string;
  name: string;
  status: string;
  onboardingConfig: unknown;
  templateCode: string | null;
  createdByMasterId?: string | null;
}

export interface EcoleInvitePending {
  id: string;
  email: string;
  schoolName: string;
}

export interface MasterAdminQueryRepository {
  // Écoles
  listSchools(where: Record<string, unknown>, skip: number, take: number): Promise<unknown[]>;
  countSchools(where: Record<string, unknown>): Promise<number>;
  findSchoolWithDetail(id: string): Promise<unknown | null>;
  findSchoolBasic(id: string): Promise<EcoleDetail | null>;
  findSchoolBySubdomain(subdomain: string): Promise<{ id: string; name: string } | null>;
  findSchoolWithPendingInvite(id: string): Promise<{ id: string; name: string; invites: EcoleInvitePending[] } | null>;

  // Journal MasterAuth
  listMasterAuthAudit(where: Record<string, unknown>, skip: number, take: number): Promise<unknown[]>;
  countMasterAuthAudit(where: Record<string, unknown>): Promise<number>;

  // Logs email
  listEmailLogs(where: Record<string, unknown>, skip: number, take: number): Promise<unknown[]>;
  countEmailLogs(where: Record<string, unknown>): Promise<number>;

  // Journal sécurité IA
  listAiActionAudit(where: Record<string, unknown>, skip: number, take: number): Promise<unknown[]>;
  countAiActionAudit(where: Record<string, unknown>): Promise<number>;

  // Rattrapage matières
  findSchoolTemplateByCode(code: string): Promise<unknown | null>;
  countSubjectsBySchool(schoolId: string): Promise<number>;
  synchroniser(schoolId: string): Promise<{ subjectsCreated: number; subjectCoefficientsUpserted: number }>;

  // Écritures (transactions) — uniquement via adapter Prisma
  supprimerEcole(id: string): Promise<void>;
  renvoyerInvitation(inviteId: string, token: string, expiresAt: Date): Promise<void>;
  changerStatutEcole(id: string, statut: 'PENDING'): Promise<void>;
  reinitialiserMfa(userId: string): Promise<void>;
  findUserForMfaReset(schoolId: string, email: string): Promise<{ id: string; role: string; mfaEnabled: boolean } | null>;
}
