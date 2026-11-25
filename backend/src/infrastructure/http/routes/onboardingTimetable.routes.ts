import { Router } from 'express';
import type { OnboardingTimetableController } from '@infrastructure/http/controllers/OnboardingTimetableController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerOnboardingTimetableRoutes(controller: OnboardingTimetableController): Router {
  const router = Router();

  router.get('/template-catalog', controller.getTemplateCatalog);
  router.post('/execute', requireAuth, requireRole('ADMIN'), controller.execute);

  return router;
}
