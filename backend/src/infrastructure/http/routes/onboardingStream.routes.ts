import { Router } from 'express';
import type { OnboardingStreamController } from '@infrastructure/http/controllers/OnboardingStreamController';

export function creerOnboardingStreamRoutes(controller: OnboardingStreamController): Router {
  const router = Router();

  router.get('/anglophone-streams', controller.listAnglophoneStreams);

  return router;
}
