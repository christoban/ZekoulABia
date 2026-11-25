import type { Request, Response, NextFunction } from 'express';
import { ConflitVersionPaiementError } from '@domain/errors/ConflitVersionPaiementError';

export function errorHandler(
  error: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (error instanceof ConflitVersionPaiementError) {
    res.status(409).json({
      success: false,
      code: 'CONFLIT_VERSION',
      message: error.message,
      data: {
        factureId: error.factureId,
        versionServeur: error.versionServeur,
        versionLocale: error.versionLocale,
        montantSaisi: error.montantSaisi,
        totalPaye: error.totalPaye,
        resteARegler: error.resteARegler,
      },
    });
    return;
  }

  console.error(`[ERROR] ${error.name} : ${error.message}`);
  const meta = 'meta' in error ? (error as Error & { meta: unknown }).meta : undefined;
  if (meta !== undefined) {
    try { console.error(`[ERROR_META] ${JSON.stringify(meta)}`); } catch {}
  }

  res.status(500).json({
    success: false,
    message: 'Une erreur interne est survenue',
    ...(process.env.NODE_ENV === 'development' && {
      detail: error.message,
      stack: error.stack,
      meta,
    }),
  });
}
