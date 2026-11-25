/**
 * MinedubReportRepository — CRUD pour les rapports statistiques MINEDUB (préscolaire/primaire).
 * Écritures : création de rapport PDF.
 * Lectures : supplement primaire.
 * Les lectures d'effectifs/personnel (resolve*PrimaryAutoFields) vivent dans StatisticalQueryPort (9.1).
 */

export interface MinedubSupplementData {
  zoneImplantation: string | null;
  ordreEnseignement: string | null;
  elevesVulnerablesDetail: unknown;
  infrastructuresDetail: unknown;
  commoditesDetail: unknown;
  manuelsDetail: unknown;
}

export interface MinedubSupplementComplet extends MinedubSupplementData {
  schoolId: string;
  lastUpdatedAt: Date;
  lastUpdatedBy: string;
}

export interface MinedubRapport {
  id: string;
  schoolId: string;
  filePath: string;
  generatedAt: Date;
}

export interface MinedubReportRepository {
  trouverSupplementPrimaire(schoolId: string): Promise<MinedubSupplementData | null>;
  trouverSupplementComplet(schoolId: string): Promise<MinedubSupplementComplet | null>;
  sauvegarderSupplement(schoolId: string, data: Record<string, unknown>, lastUpdatedBy: string): Promise<MinedubSupplementComplet>;
  creerRapport(data: {
    schoolId: string;
    generatedBy: string;
    filePath: string;
    champsNonResolus: unknown;
  }): Promise<{ id: string }>;
  listerRapports(schoolId: string): Promise<MinedubRapport[]>;
  trouverRapportParId(id: string): Promise<MinedubRapport | null>;
}
