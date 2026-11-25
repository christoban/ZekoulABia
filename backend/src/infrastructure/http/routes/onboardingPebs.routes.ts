import { Router } from 'express';
import type { OnboardingPEBSController } from '@infrastructure/http/controllers/OnboardingPEBSController';
import { requireAuth, requireRole } from '../middlewares/auth.ts';

export function creerOnboardingPebsRoutes(controller: OnboardingPEBSController): Router {
  const router = Router();

  router.post('/analyze-pebs', requireAuth, requireRole('ADMIN'), controller.analyze);

  return router;
}
