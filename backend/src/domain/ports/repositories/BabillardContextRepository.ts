import type { UtilisateurContexte } from '@domain/rules/BabillardVisibilityRules';

export interface BabillardContextQuery {
  userId: string;
  schoolId: string;
  role: string;
  permissions?: string[];
}

/** Résout le périmètre de visibilité d'un utilisateur pour le babillard. */
export interface BabillardContextRepository {
  chargerUtilisateurContexte(query: BabillardContextQuery): Promise<UtilisateurContexte>;
}
