/**
 * DOMAIN PORT — Repository des Publications du Babillard Officiel
 */

import type { Publication, PublicationProps } from '../../entities/Publication';
import type { UtilisateurContexte } from '../../rules/BabillardVisibilityRules';

export interface PublicationFiltres {
  filtre?: 'tous' | 'une' | 'pourMoi' | 'nonLus' | 'archives';
  categorie?: string;
  recherche?: string;
  curseur?: string;
  limite?: number;
}

export interface StatistiquesLecture {
  lecturesCount: number;
  destinatairesEligiblesCount: number;
}

export interface PublicationRepository {
  creer(publication: Publication): Promise<Publication>;
  modifier(id: string, schoolId: string, data: Partial<PublicationProps>): Promise<Publication>;
  trouverParId(id: string, schoolId: string): Promise<Publication | null>;
  lister(schoolId: string, filtres: PublicationFiltres): Promise<{ publications: Publication[]; curseurSuivant?: string }>;
  supprimerLogique(id: string, schoolId: string): Promise<void>;
  compterEpinglesActifs(schoolId: string): Promise<number>;
  desepinglerLaPlusAncienne(schoolId: string): Promise<void>;
  epingler(id: string, schoolId: string, epinglee: boolean): Promise<Publication>;
  marquerCommeLu(publicationId: string, userId: string, schoolId: string): Promise<void>;
  estLuParUtilisateur(publicationId: string, userId: string): Promise<boolean>;
  getIdsLusParUtilisateur(userId: string, publicationIds: string[]): Promise<Set<string>>;
  compterNonLus(schoolId: string, user: UtilisateurContexte): Promise<number>;
  compterLectures(publicationId: string, schoolId: string): Promise<number>;
  compterDestinatairesEligibles(publication: Publication): Promise<number>;
  obtenirStatistiquesLecture(publication: Publication): Promise<StatistiquesLecture>;
  enregistrerAudit(data: {
    schoolId: string;
    publicationId: string;
    userId: string;
    action: string;
    details?: Record<string, unknown>;
  }): Promise<void>;
}
