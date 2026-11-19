/**
 * DOMAIN LAYER — Port Repository SchoolConfig
 * Configuration des seuils et paramètres par école.
 */
import type { BulletinGroupingScheme, BulletinTemplate } from '@domain/types/enums';

export interface SchoolConfigRepository {
  findBySchool(schoolId: string): Promise<SchoolConfigData | null>;
  findBySchoolId(schoolId: string): Promise<SchoolConfigData | null>;
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
