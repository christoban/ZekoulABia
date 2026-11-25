/**
 * StatisticalCampaignRepository — CRUD pour les campagnes statistiques MINESEC.
 * Écritures : création de submission (PENDING_MANUAL_DATA ou DRAFT).
 * Lectures : supplement (Catégorie C), template actif.
 * Les lectures massives (resolve*AutoFields) vivent dans StatisticalQueryPort (9.1).
 */

export interface SupplementData {
  hasTitreFoncier: boolean | null;
  siteProvisoire: boolean | null;
  superficieTerrainM2: number | null;
  hasInternat: boolean | null;
  posteComptable: string | null;
  effectifsTechniquesDetail: unknown;
  infrastructuresDetail: unknown;
  historiqueBip: unknown;
  lastUpdatedAt: Date;
  [key: string]: unknown;
}

export interface TemplateData {
  id: string;
  filePath: string;
}

export interface StatisticalSubmission {
  id: string;
  schoolId: string;
  filePath: string | null;
  generatedAt: Date;
}

export interface EcoleStatistiqueMeta {
  subsystem: string;
  educationType: string;
}

export interface StatisticalCampaignRepository {
  trouverSupplement(schoolId: string): Promise<SupplementData | null>;
  trouverTemplateActif(ministry: string): Promise<TemplateData | null>;
  creerSubmission(data: {
    schoolId: string;
    templateId: string;
    generatedBy: string;
    status: 'PENDING_MANUAL_DATA' | 'DRAFT';
    filePath?: string | null;
    unresolvedFieldsReport?: unknown;
  }): Promise<{ id: string }>;
  sauvegarderSupplement(schoolId: string, data: Record<string, unknown>, lastUpdatedBy: string): Promise<SupplementData>;
  trouverEcoleMeta(schoolId: string): Promise<EcoleStatistiqueMeta | null>;
  trouverSubmissionParId(id: string): Promise<StatisticalSubmission | null>;
  listerDernieresSubmissions(schoolId: string): Promise<StatisticalSubmission[]>;
}
