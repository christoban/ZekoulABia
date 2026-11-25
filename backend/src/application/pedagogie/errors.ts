/**
 * APPLICATION LAYER — Erreurs typées du module pédagogie.
 * Permettent au controller de mapper le nom d'erreur vers un statut HTTP.
 */
export class PedagogieValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PedagogieValidationError';
  }
}

export class PedagogieNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PedagogieNotFoundError';
  }
}

export class PedagogieForbiddenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PedagogieForbiddenError';
  }
}
