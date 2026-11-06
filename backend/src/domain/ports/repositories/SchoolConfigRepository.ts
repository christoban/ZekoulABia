/**
 * DOMAIN LAYER — Port Repository SchoolConfig
 * Configuration des seuils et paramètres par école.
 */
export interface SchoolConfigRepository {
  findBySchool(schoolId: string): Promise<SchoolConfigData | null>;
  findBySchoolId(schoolId: string): Promise<SchoolConfigData | null>;
}

export interface SchoolConfigData {
  aiAlertsEnabled: boolean;
  subjectDropThreshold: number;
}
