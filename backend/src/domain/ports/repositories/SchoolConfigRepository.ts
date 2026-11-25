/**
 * DOMAIN LAYER — Port Repository SchoolConfig
 * Configuration des seuils et paramètres par école.
 */
import type { BulletinGroupingScheme, BulletinTemplate } from '@domain/types/enums';

export interface UpsertBulletinConfigInput {
  bulletinTemplate?: BulletinTemplate;
  bulletinGroupingScheme?: BulletinGroupingScheme;
  useMeasuredBulletinRenderer?: boolean;
}

export interface SchoolConfigRepository {
  findBySchool(schoolId: string): Promise<SchoolConfigData | null>;
  findBySchoolId(schoolId: string): Promise<SchoolConfigData | null>;
  upsertBulletinConfig?(schoolId: string, input: UpsertBulletinConfigInput): Promise<SchoolConfigData>;
}

export interface SchoolConfigData {
  aiAlertsEnabled: boolean;
  subjectDropThreshold: number;
  absenceAlertThreshold?: number;
  bulletinBlockOnUnpaidFees?: boolean;
  defaultInstallmentsCount?: number;
  mobileMoneyFeeBearer?: string;
  bulletinTemplate?: BulletinTemplate;
  bulletinGroupingScheme?: BulletinGroupingScheme;
  useMeasuredBulletinRenderer?: boolean;
  sequenceCalculationMode?: string;
  classTestWeight?: number;
  terminalExamWeight?: number;
  ds1Weight?: number;
  ds2Weight?: number;
  compositionWeight?: number;
  passMark?: number;
  councilPassMark?: number;
}
