import { Router } from 'express';
import type { InviteOnboardingController } from '@infrastructure/http/controllers/InviteOnboardingController';

export function creerInviteOnboardingRoutes(controller: InviteOnboardingController): Router {
  const router = Router();

  router.get('/invite/:token', controller.validateInvite);
  router.post('/invite/:token/complete', controller.completeOnboarding);
  router.post('/preview-structure', controller.previewStructure);

  return router;
}
