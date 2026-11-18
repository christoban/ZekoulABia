/**
 * DOMAIN LAYER — Port Repository SchoolAdminQueries
 * Encapsule les requêtes d'administration d'établissement (profil, logo, sous-domaine,
 * paramètres de notification/sécurité, export RGPD, journaux d'audit).
 */

export interface SchoolMeInfo {
  id: string;
  name: string;
  subdomain: string;
  logoUrl: string | null;
  plan: string;
  city: string | null;
  region: string | null;
  phone: string | null;
  email: string | null;
  subsystem: string;
  status: string;
  educationType: string;
  ownership: string;
  onboardingConfig: unknown;
  hasPEBSFrancophone: boolean;
  hasPEBSAnglophone: boolean;
  minesecSchoolCode: string | null;
  templateCode: string | null;
}

export interface SchoolLastBackupSettings {
  lastBackupAt: Date | null;
  lastBackupFile: string | null;
}

export interface SchoolExportBundle {
  schoolName: string;
  exportPayload: unknown;
}

export interface SchoolTemplateOnboarding {
  templateCode: string | null;
  onboardingConfig: unknown;
}

export interface UpdateSchoolProfileInput {
  name?: string;
  city?: string;
  phone?: string;
  email?: string;
  minesecSchoolCode?: string;
}

export interface SchoolProfileSummary {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  email: string | null;
  minesecSchoolCode: string | null;
}

export interface SchoolNotificationSettingsFlags {
  smsAbsences: boolean;
  smsPayments: boolean;
  smsBulletins: boolean;
  emailDigestAdmin: boolean;
  smsLowBalance: boolean;
}

export interface SchoolNotificationSettingsRecord extends SchoolNotificationSettingsFlags {
  id: string;
  schoolId: string;
}

export interface SchoolSecuritySettingsData {
  passwordMinLength: number;
  passwordRequireUpper: boolean;
  passwordRequireDigit: boolean;
  sessionTimeoutMin: number;
}

export interface FindSchoolAuditLogsInput {
  schoolId: string;
  page: number;
  limit: number;
  action?: string;
  userId?: string;
  fromDate?: string;
  toDate?: string;
}

export interface SchoolAuditLogUser {
  id: string;
  firstName: string;
  lastName: string;
}

export interface SchoolAuditLogEntry {
  id: string;
  schoolId: string | null;
  userId: string | null;
  action: string;
  description: string | null;
  metadata: unknown;
  createdAt: Date;
  user: SchoolAuditLogUser | null;
}

export interface FindSchoolAuditLogsResult {
  logs: SchoolAuditLogEntry[];
  total: number;
}

export interface SchoolAdminQueriesRepository {
  findSchoolMe(schoolId: string): Promise<SchoolMeInfo | null>;
  findLastBackupSettings(schoolId: string): Promise<SchoolLastBackupSettings | null>;
  findExportBundle(schoolId: string): Promise<SchoolExportBundle | null>;
  findTemplateAndOnboarding(schoolId: string): Promise<SchoolTemplateOnboarding | null>;
  findOnboardingConfig(schoolId: string): Promise<{ onboardingConfig: unknown } | null>;
  updateLogo(schoolId: string, logoUrl: string | null): Promise<{ logoUrl: string | null }>;
  updateProfile(schoolId: string, data: UpdateSchoolProfileInput): Promise<SchoolProfileSummary>;
  isSubdomainTakenByOther(subdomain: string, excludeSchoolId: string): Promise<boolean>;
  updateSubdomain(schoolId: string, subdomain: string): Promise<void>;
  upsertNotificationSettings(
    schoolId: string,
    data?: Partial<SchoolNotificationSettingsFlags>,
  ): Promise<SchoolNotificationSettingsRecord>;
  findSecuritySettings(schoolId: string): Promise<SchoolSecuritySettingsData | null>;
  upsertSecuritySettings(
    schoolId: string,
    data: Partial<SchoolSecuritySettingsData>,
  ): Promise<SchoolSecuritySettingsData>;
  findAuditLogs(input: FindSchoolAuditLogsInput): Promise<FindSchoolAuditLogsResult>;
}
