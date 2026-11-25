/**
 * DOMAIN LAYER — Port de lecture dédié à la ré-application de template en masse (V0.4 Phase 3).
 * Lecture seule — aucune écriture. Pattern ClassCouncilPreviewQueryPort.
 */

export interface EcoleParTemplate {
  id: string;
  name: string;
}

export interface TemplateReapplicationQueryPort {
  /** Liste les écoles ACTIVES utilisant un template donné. */
  listerEcolesParTemplate(templateCode: string): Promise<EcoleParTemplate[]>;
}
