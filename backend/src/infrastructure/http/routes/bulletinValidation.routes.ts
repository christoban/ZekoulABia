/**
 * HTTP LAYER — Routes pour le workflow de validation des bulletins par classe/période.
 */
import { Router } from 'express';
import type { BulletinValidationController } from '@infrastructure/http/controllers/BulletinValidationController';
import { requireAuth } from '../middlewares/auth.ts';
import { sensitiveWriteLimiter } from '../middlewares/rateLimit.ts';

export function creerBulletinValidationRoutes(controller: BulletinValidationController): Router {
  const router = Router();

  router.get('/', requireAuth, controller.listerHandler);
  router.post('/', sensitiveWriteLimiter, requireAuth, controller.soumettreHandler);
  router.post('/:id/validate', sensitiveWriteLimiter, requireAuth, controller.validerHandler);
  router.post('/:id/publish', sensitiveWriteLimiter, requireAuth, controller.publierHandler);

  return router;
}