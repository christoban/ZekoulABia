import { Router, type NextFunction, type Response } from 'express';
import type { ObtenirListeAnonymatParTokenUseCase } from '@application/assessment/ObtenirListeAnonymatParTokenUseCase';
import type { MarquerAnonymisationTermineeUseCase } from '@application/assessment/MarquerAnonymisationTermineeUseCase';
import { AnonymatDomainError } from '@domain/errors/AnonymatErrors';

function envoyerErreur(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof AnonymatDomainError) {
    let status = 400;
    if (error.code === 'TOKEN_EXPIRED' || error.code === 'ALREADY_DONE') {
      status = 410;
    } else if (error.code === 'TOKEN_INVALID') {
      status = 400;
    } else {
      status = 404;
    }
    res.status(status).json({ success: false, error: error.code, message: error.message });
    return;
  }
  next(error);
}

export function creerAnonymatPublicRoutes(
  obtenirListe: ObtenirListeAnonymatParTokenUseCase,
  marquerTerminee: MarquerAnonymisationTermineeUseCase,
): Router {
  const router = Router();

  router.get('/lists/:token', async (req, res, next) => {
    try {
      const result = await obtenirListe.execute(req.params.token);
      res.json({ success: true, data: result });
    } catch (error) {
      envoyerErreur(error, res, next);
    }
  });

  router.post('/lists/:token/done', async (req, res, next) => {
    try {
      const result = await marquerTerminee.execute(req.params.token);
      res.json({ success: true, data: result });
    } catch (error) {
      envoyerErreur(error, res, next);
    }
  });

  return router;
}
