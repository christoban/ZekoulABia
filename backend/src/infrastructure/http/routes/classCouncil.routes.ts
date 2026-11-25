import { Router } from 'express';
import type { ClassCouncilController } from '@infrastructure/http/controllers/ClassCouncilController';
import { requireAuth } from '../middlewares/auth.ts';
import { sensitiveWriteLimiter } from '../middlewares/rateLimit.ts';

export function creerClassCouncilRoutes(controller: ClassCouncilController): Router {
  const router = Router();

  router.get('/', requireAuth, controller.listerSessionsHandler);
  router.get('/preview', requireAuth, controller.preparerVueHandler);
  router.post('/', sensitiveWriteLimiter, requireAuth, controller.creerSessionHandler);
  router.get('/:id', requireAuth, controller.obtenirSessionHandler);
  router.post('/:id/decisions', requireAuth, controller.ajouterDecisionHandler);
  router.post('/:id/decisions/bulk', requireAuth, controller.ajouterDecisionsEnBlocHandler);
  router.post('/:id/lock', sensitiveWriteLimiter, requireAuth, controller.verrouillerHandler);
  router.post('/:id/publish-bulletins', sensitiveWriteLimiter, requireAuth, controller.publicerBulletinsHandler);
  router.get('/:id/report', requireAuth, controller.genererRapportHandler);
  router.get('/:id/pv', requireAuth, controller.genererPVHandler);

  return router;
}
