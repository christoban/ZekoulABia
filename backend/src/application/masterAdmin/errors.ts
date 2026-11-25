/**
 * APPLICATION LAYER — Erreurs typées du module masterAdmin.
 * Permettent au controller de mapper le nom d'erreur vers un statut HTTP.
 */
export class MasterAdminNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MasterAdminNotFoundError';
  }
}

export class MasterAdminValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MasterAdminValidationError';
  }
}
