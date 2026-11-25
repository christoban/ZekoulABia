import { Router } from 'express';
import type { CoreDomainController } from '@infrastructure/http/controllers/CoreDomainController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerCoreDomainRoutes(controller: CoreDomainController): Router {
  const router = Router();

  router.get('/subsystems', requireAuth, controller.getSubSystems);
  router.post('/subsystems/upsert-defaults', requireAuth, requireRole('ADMIN'), controller.upsertDefaults);
  router.post('/academic-periods', requireAuth, requireRole('ADMIN'), controller.createPeriod);
  router.get('/academic-periods', requireAuth, controller.getPeriods);
  router.patch('/academic-periods/:id', requireAuth, requireRole('ADMIN'), controller.updatePeriod);

  return router;
}
